import Foundation
import HealthKit
import WebKit

/// Read-only HealthKit bridge for the Forge web app.
final class ForgeHealthMessageHandler: NSObject, WKScriptMessageHandler {
    private let healthStore = HKHealthStore()
    private weak var webView: WKWebView?

    init(webView: WKWebView) {
        self.webView = webView
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "forgeHealth",
              let body = message.body as? [String: Any],
              let requestId = body["requestId"] as? String,
              body["action"] as? String == "readSteps",
              let dateText = body["date"] as? String else { return }

        readSteps(on: dateText) { [weak self] result in
            self?.reply(to: requestId, result: result)
        }
    }

    private func readSteps(on dateText: String, completion: @escaping ([String: Any]) -> Void) {
        guard HKHealthStore.isHealthDataAvailable(),
              let stepType = HKObjectType.quantityType(forIdentifier: .stepCount) else {
            completion(["ok": false, "error": "Apple Health is not available on this device."])
            return
        }

        healthStore.requestAuthorization(toShare: [], read: [stepType]) { [weak self] _, error in
            if let error {
                completion(["ok": false, "error": error.localizedDescription])
                return
            }
            guard let self, let interval = self.localDay(dateText) else {
                completion(["ok": false, "error": "The requested date was invalid."])
                return
            }

            let predicate = HKQuery.predicateForSamples(
                withStart: interval.start,
                end: interval.end,
                options: .strictStartDate
            )
            let query = HKStatisticsQuery(
                quantityType: stepType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, statistics, queryError in
                if let queryError {
                    completion(["ok": false, "error": queryError.localizedDescription])
                    return
                }
                let count = statistics?.sumQuantity()?.doubleValue(for: .count()) ?? 0
                completion(["ok": true, "steps": Int(count.rounded()), "source": "apple-health"])
            }
            self.healthStore.execute(query)
        }
    }

    private func localDay(_ text: String) -> DateInterval? {
        let formatter = DateFormatter()
        formatter.calendar = .current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: text) else { return nil }
        return Calendar.current.dateInterval(of: .day, for: date)
    }

    private func reply(to requestId: String, result: [String: Any]) {
        guard JSONSerialization.isValidJSONObject([requestId, result]),
              let data = try? JSONSerialization.data(withJSONObject: [requestId, result]),
              let arguments = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(
                "window.ForgeHealthBridge.resolve.apply(null, \(arguments))"
            )
        }
    }
}
