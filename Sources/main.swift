import Cocoa
import WebKit
import Security

let databaseURL = "https://app.notion.com/p/5ccb86c070be4b48bb40e594d2297a97?v=2c7b61d0ff4080258ac4000cb9e4aafa"
let sourceID = "89bdeda5-7ece-4c20-bc83-9c3fd6e1b79c"
let keyQuery: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "app.liveline.notion", kSecAttrAccount as String: "integration"]
func token() -> String? {
    var q = keyQuery; q[kSecReturnData as String] = true
    var result: CFTypeRef?
    guard SecItemCopyMatching(q as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }
    return String(data: data, encoding: .utf8)
}
func saveToken(_ value: String) throws {
    let data = Data(value.utf8)
    var status = SecItemUpdate(keyQuery as CFDictionary, [kSecValueData as String: data] as CFDictionary)
    if status == errSecItemNotFound {
        var q = keyQuery; q[kSecValueData as String] = data; q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        status = SecItemAdd(q as CFDictionary, nil)
    }
    if status != errSecSuccess { throw NSError(domain: "Keychain", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Could not save the connection in Keychain (\(status))."]) }
}

// Reads a Notion property of any common type as a plain value (string or number) for benefit parsing in JS.
func plainValue(_ prop: [String: Any]?) -> Any {
    guard let prop, let type = prop["type"] as? String else { return NSNull() }
    let v = prop[type]
    switch type {
    case "select", "status": return (v as? [String: Any])?["name"] as? String ?? NSNull()
    case "multi_select": return ((v as? [[String: Any]]) ?? []).compactMap { $0["name"] as? String }.joined(separator: " ")
    case "number": return v as? NSNumber ?? NSNull()
    case "rich_text", "title": return ((v as? [[String: Any]]) ?? []).compactMap { $0["plain_text"] as? String }.joined()
    case "formula", "rollup":
        guard let f = v as? [String: Any], let t = f["type"] as? String else { return NSNull() }
        return f[t] as? NSNumber ?? f[t] as? String ?? NSNull()
    default: return NSNull()
    }
}

class App: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate {
    var window: NSWindow!; var web: WKWebView!; var syncing = false; var lastSync = Date.distantPast
    let cache = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Liveline/agenda.json")
    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu(); let root = NSMenuItem(); menu.addItem(root)
        let appMenu = NSMenu(); appMenu.addItem(withTitle: "About Liveline", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator()); appMenu.addItem(withTitle: "Quit Liveline", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"); root.submenu = appMenu
        let edit = NSMenuItem(); edit.title = "Edit"; let editMenu = NSMenu(title: "Edit")
        for (title, action, key) in [("Cut", "cut:", "x"), ("Copy", "copy:", "c"), ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")] { editMenu.addItem(withTitle: title, action: Selector(action), keyEquivalent: key) }; edit.submenu = editMenu; menu.addItem(edit); NSApp.mainMenu = menu
        let config = WKWebViewConfiguration(); config.userContentController.add(self, name: "native")
        web = WKWebView(frame: .zero, configuration: config); web.navigationDelegate = self
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1320, height: 880), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Liveline"; window.minSize = NSSize(width: 1000, height: 700); window.contentView = web; window.center(); window.makeKeyAndOrderFront(nil)
        let url = Bundle.main.url(forResource: "index", withExtension: "html")!
        web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        NSApp.activate(ignoringOtherApps: true)
        Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { [weak self] _ in if token() != nil { self?.sync() } }
    }
    // Pull fresh Notion data whenever you come back to the app (at most once a minute).
    func applicationDidBecomeActive(_ notification: Notification) { if web != nil, token() != nil, Date().timeIntervalSince(lastSync) > 60 { sync() } }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { window.makeKeyAndOrderFront(nil); return true }
    func send(_ event: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: event), let text = String(data: data, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.receive(\(text))", completionHandler: nil)
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // The bundled snapshot is personal and gitignored; a fresh clone starts empty until Notion is connected.
        let path = FileManager.default.fileExists(atPath: cache.path) ? cache : Bundle.main.url(forResource: "snapshot", withExtension: "json")
        send(["type": "game", "value": UserDefaults.standard.string(forKey: "game") ?? ""])
        if let path, let data = try? Data(contentsOf: path), let value = try? JSONSerialization.jsonObject(with: data) { send(["type": "data", "value": value, "connected": token() != nil]) } else { send(["type": "data", "value": ["rows": [], "source": "snapshot"], "connected": token() != nil]) }
        if token() != nil { sync() }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(navigationAction.request.url?.isFileURL == true ? .allow : .cancel)
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: String] else { return }
        switch body["action"] {
        case "sync": if token() == nil { send(["type": "connect"]) } else { sync() }
        case "saveToken":
            let value = (body["token"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !value.isEmpty else { return }
            do { try saveToken(value); send(["type": "connected"]); sync() } catch { send(["type": "error", "message": error.localizedDescription]) }
        case "saveGame": UserDefaults.standard.set(body["value"] ?? "", forKey: "game")
        case "disconnect": SecItemDelete(keyQuery as CFDictionary); send(["type": "disconnected"])
        case "open":
            if let url = URL(string: body["url"] ?? databaseURL), url.scheme == "https", ["app.notion.com", "www.notion.so", "notion.so", "www.notion.com"].contains(url.host ?? "") { NSWorkspace.shared.open(url) }
        default: break
        }
    }
    func sync() {
        guard !syncing, let secret = token() else { return }; syncing = true; lastSync = Date(); send(["type": "syncing"])
        Task { @MainActor in
            defer { syncing = false }
            do {
                var benefitColumn: String? = nil
                func fetch(_ filter: [String: Any]) async throws -> [[String: Any]] {
                var rows = [[String: Any]](); var cursor: String? = nil
                repeat {
                    var request = URLRequest(url: URL(string: "https://api.notion.com/v1/data_sources/\(sourceID)/query")!); request.httpMethod = "POST"; request.timeoutInterval = 30
                    request.setValue("Bearer \(secret)", forHTTPHeaderField: "Authorization"); request.setValue("2025-09-03", forHTTPHeaderField: "Notion-Version"); request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    var body: [String: Any] = ["page_size": 100, "filter": filter]
                    if let cursor { body["start_cursor"] = cursor }; request.httpBody = try JSONSerialization.data(withJSONObject: body)
                    let (data, response) = try await URLSession.shared.data(for: request)
                    guard let response = response as? HTTPURLResponse, response.statusCode == 200 else { throw NSError(domain: "Notion", code: 1, userInfo: [NSLocalizedDescriptionKey: "Notion could not refresh. Check the token and share the agenda database with your integration, then retry. Your saved map is still available."]) }
                    guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any], let pages = json["results"] as? [[String: Any]] else { throw NSError(domain: "Notion", code: 2) }
                    for page in pages {
                        guard let p = page["properties"] as? [String: [String: Any]], p["task"] != nil, p["severity"] != nil, p["hard dln"] != nil else { throw NSError(domain: "Notion", code: 3, userInfo: [NSLocalizedDescriptionKey: "Agenda columns changed. Expected task, severity, and hard dln."]) }
                        func text(_ key: String, _ type: String) -> String { (p[key]?[type] as? [[String: Any]] ?? []).compactMap { $0["plain_text"] as? String }.joined() }
                        func choice(_ key: String, _ type: String) -> String { (p[key]?[type] as? [String: Any])?["name"] as? String ?? "" }
                        func date(_ key: String) -> Any { let d = p[key]?["date"] as? [String: Any]; return d?["end"] as? String ?? d?["start"] as? String ?? NSNull() as Any }
                        let benefitKey = p.keys.sorted().first { $0.lowercased().contains("benefit") }
                        if benefitColumn == nil { benefitColumn = benefitKey }
                        rows.append(["benefit": plainValue(benefitKey.flatMap { p[$0] }), "id": page["id"] ?? "", "url": page["url"] ?? "", "title": text("task", "title"), "severity": choice("severity", "select"), "status": choice("status", "status"), "domain": choice("domain", "select"), "hard": date("hard dln"), "soft": date("soft dln"), "notes": text("notes", "rich_text"), "edited": page["last_edited_time"] ?? NSNull()])
                    }
                    cursor = json["has_more"] as? Bool == true ? json["next_cursor"] as? String : nil
                    if cursor != nil { try await Task.sleep(nanoseconds: 350_000_000) }
                } while cursor != nil
                return rows
                }
                var rows = try await fetch(["and": ["DONE", "~done", "missed", "abandon"].map { ["property": "status", "status": ["does_not_equal": $0]] }])
                // Tasks finished in the last 14 days become shoot-down targets. Optional: a failure here never blocks the agenda refresh.
                let since = ISO8601DateFormatter().string(from: Date().addingTimeInterval(-14 * 86400))
                let finished: [String: Any] = ["and": [["or": ["DONE", "~done"].map { ["property": "status", "status": ["equals": $0]] }], ["timestamp": "last_edited_time", "last_edited_time": ["on_or_after": since]]]]
                rows += (try? await fetch(finished)) ?? []
                let snapshot: [String: Any] = ["rows": rows, "updatedAt": ISO8601DateFormatter().string(from: Date()), "source": "live", "benefitColumn": benefitColumn ?? NSNull()]
                try FileManager.default.createDirectory(at: cache.deletingLastPathComponent(), withIntermediateDirectories: true)
                try JSONSerialization.data(withJSONObject: snapshot).write(to: cache, options: .atomic)
                try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: cache.path)
                send(["type": "data", "value": snapshot, "connected": true])
            } catch { send(["type": "error", "message": error.localizedDescription]) }
        }
    }
}
let app = NSApplication.shared
let delegate = App(); app.delegate = delegate; app.setActivationPolicy(.regular); app.run()
