import UIKit
import Capacitor

/// Contrôleur principal : enregistre les plugins natifs propres à Etheria.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PedometerPlugin())
    }
}
