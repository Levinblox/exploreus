import ActivityKit
import Foundation

// Shared between the app (LiveActivityPlugin) and the widget extension.
// IMPORTANT: add this file to BOTH targets' membership in Xcode.
struct HikeActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var elapsed: String        // "1:23:45"
        var distance: String       // "4.20 km"
        var remaining: String?     // "2.10 km" — only when following a trail
        var progress: Double       // 0...1 along the followed trail
        var snapshotName: String?  // filename of the route image in the App Group
        var snapshotVersion: Int   // bump to force the widget to reload the image
    }

    var title: String              // hike name or followed trail name
}
