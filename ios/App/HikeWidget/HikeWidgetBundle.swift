import SwiftUI
import WidgetKit

// Entry point for the widget extension. Keep exactly ONE @main WidgetBundle in
// the target — if Xcode's wizard generated its own, replace its contents with
// this (or delete the generated one).
@main
struct HikeWidgetBundle: WidgetBundle {
    var body: some Widget {
        HikeLiveActivity()
    }
}
