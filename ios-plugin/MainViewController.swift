import UIKit
import Capacitor

/// Contrôleur principal : enregistre les plugins natifs propres à Pixels Worlds.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PedometerPlugin())
    }
}
