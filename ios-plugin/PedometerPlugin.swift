import Foundation
import Capacitor
import CoreMotion

/// Plugin natif « Pedometer » : lit les pas du téléphone via CoreMotion.
/// Appelé depuis client/steps.js → Capacitor.registerPlugin('Pedometer').stepsSince({ since })
@objc(PedometerPlugin)
public class PedometerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PedometerPlugin"
    public let jsName = "Pedometer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "stepsSince", returnType: CAPPluginReturnPromise)
    ]
    private let pedometer = CMPedometer()

    @objc func stepsSince(_ call: CAPPluginCall) {
        guard CMPedometer.isStepCountingAvailable() else {
            call.reject("Step counting not available on this device")
            return
        }
        let sinceMs = call.getDouble("since") ?? (Date().timeIntervalSince1970 * 1000 - 86_400_000)
        let since = Date(timeIntervalSince1970: sinceMs / 1000)
        pedometer.queryPedometerData(from: since, to: Date()) { data, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            call.resolve(["steps": data?.numberOfSteps.intValue ?? 0])
        }
    }
}
