import ActivityKit
import Capacitor
import CoreLocation
import Foundation
import MapKit
import UIKit

// Capacitor bridge to an iOS Live Activity. Exposed to JS as "LiveActivity"
// with start/update/end (see src/lib/liveActivity.ts).
//
// App Group "group.com.exploreus.app" must be enabled on BOTH the app target
// and the widget target — it's where the route mini-map image is shared.
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
    ]

    static let appGroupId = "group.com.exploreus.app"
    private var activityRef: Any?     // Activity<HikeActivityAttributes>
    private var snapshotVersion = 0

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        let title = call.getString("title") ?? "Hike"
        DispatchQueue.main.async {
            guard ActivityAuthorizationInfo().areActivitiesEnabled else {
                call.resolve(); return
            }
            self.endInternal()
            let attributes = HikeActivityAttributes(title: title)
            let state = HikeActivityAttributes.ContentState(
                elapsed: "0:00", distance: "0 m", remaining: nil,
                progress: 0, snapshotName: nil, snapshotVersion: 0
            )
            do {
                self.activityRef = try Activity.request(
                    attributes: attributes,
                    content: ActivityContent(state: state, staleDate: nil),
                    pushType: nil
                )
            } catch {
                CAPLog.print("LiveActivity start failed: \(error)")
            }
            call.resolve()
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        let elapsed = call.getString("elapsed") ?? ""
        let distance = call.getString("distance") ?? ""
        let remaining = call.getString("remaining")
        let progress = call.getDouble("progress") ?? 0
        let trackJson = call.getString("trackJson") ?? "[]"
        let curLat = call.getDouble("curLat")
        let curLng = call.getDouble("curLng")

        let track = Self.parseTrack(trackJson)
        let current: CLLocationCoordinate2D? = (curLat != nil && curLng != nil)
            ? CLLocationCoordinate2D(latitude: curLat!, longitude: curLng!) : nil

        Self.makeSnapshot(track: track, current: current) { name in
            DispatchQueue.main.async {
                guard #available(iOS 16.2, *),
                      let activity = self.activityRef as? Activity<HikeActivityAttributes> else {
                    call.resolve(); return
                }
                if name != nil { self.snapshotVersion += 1 }
                let state = HikeActivityAttributes.ContentState(
                    elapsed: elapsed, distance: distance, remaining: remaining,
                    progress: progress, snapshotName: name,
                    snapshotVersion: self.snapshotVersion
                )
                Task {
                    await activity.update(ActivityContent(state: state, staleDate: nil))
                    call.resolve()
                }
            }
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        DispatchQueue.main.async {
            self.endInternal()
            call.resolve()
        }
    }

    @available(iOS 16.2, *)
    private func endInternal() {
        for activity in Activity<HikeActivityAttributes>.activities {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
        self.activityRef = nil
    }

    private static func parseTrack(_ json: String) -> [CLLocationCoordinate2D] {
        guard let data = json.data(using: .utf8),
              let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Double]]
        else { return [] }
        return arr.compactMap { d in
            guard let lat = d["lat"], let lng = d["lng"] else { return nil }
            return CLLocationCoordinate2D(latitude: lat, longitude: lng)
        }
    }

    // Render the route + current position to a PNG in the shared App Group
    // container; the widget reads it from there. Returns the filename.
    private static func makeSnapshot(
        track: [CLLocationCoordinate2D],
        current: CLLocationCoordinate2D?,
        completion: @escaping (String?) -> Void
    ) {
        let points = track.isEmpty ? (current.map { [$0] } ?? []) : track
        guard !points.isEmpty,
              let container = FileManager.default
                .containerURL(forSecurityApplicationGroupIdentifier: appGroupId)
        else { completion(nil); return }

        var rect = MKMapRect.null
        for c in points {
            let p = MKMapPoint(c)
            rect = rect.union(MKMapRect(x: p.x, y: p.y, width: 0, height: 0))
        }
        let options = MKMapSnapshotter.Options()
        options.mapRect = rect.insetBy(dx: -(rect.size.width * 0.3) - 250,
                                       dy: -(rect.size.height * 0.3) - 250)
        options.size = CGSize(width: 320, height: 200)
        options.mapType = .standard

        MKMapSnapshotter(options: options).start(with: .global(qos: .utility)) { snapshot, _ in
            guard let snapshot = snapshot else { completion(nil); return }
            let image = UIGraphicsImageRenderer(size: options.size).image { ctx in
                snapshot.image.draw(at: .zero)
                let cg = ctx.cgContext
                cg.setStrokeColor(UIColor.systemGreen.cgColor)
                cg.setLineWidth(4); cg.setLineJoin(.round); cg.setLineCap(.round)
                var first = true
                for c in track {
                    let pt = snapshot.point(for: c)
                    if first { cg.move(to: pt); first = false } else { cg.addLine(to: pt) }
                }
                cg.strokePath()
                if let cur = current {
                    let pt = snapshot.point(for: cur)
                    UIColor.white.setFill()
                    cg.fillEllipse(in: CGRect(x: pt.x - 7, y: pt.y - 7, width: 14, height: 14))
                    UIColor.systemGreen.setFill()
                    cg.fillEllipse(in: CGRect(x: pt.x - 4, y: pt.y - 4, width: 8, height: 8))
                }
            }
            guard let data = image.pngData() else { completion(nil); return }
            let name = "hike_map.png"
            do {
                try data.write(to: container.appendingPathComponent(name), options: .atomic)
                completion(name)
            } catch {
                completion(nil)
            }
        }
    }
}
