import ActivityKit
import SwiftUI
import UIKit
import WidgetKit

// Lock-screen + Dynamic Island UI for an active hike.
// Uses HikeActivityAttributes — add that shared file to THIS target too.
// The widget target's min deployment must be iOS 16.2+.
struct HikeWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: HikeActivityAttributes.self) { context in
            HikeLockScreenView(state: context.state, title: context.attributes.title)
                .padding(14)
                .activityBackgroundTint(Color.black.opacity(0.85))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(context.state.distance, systemImage: "figure.hiking")
                        .font(.headline).foregroundStyle(.green)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Label(context.state.elapsed, systemImage: "clock")
                        .font(.headline)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if let remaining = context.state.remaining {
                        VStack(alignment: .leading, spacing: 4) {
                            ProgressView(value: context.state.progress).tint(.green)
                            Text("\(remaining) to go")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: "figure.hiking").foregroundStyle(.green)
            } compactTrailing: {
                Text(context.state.distance).font(.caption2)
            } minimal: {
                Image(systemName: "figure.hiking").foregroundStyle(.green)
            }
        }
    }
}

struct HikeLockScreenView: View {
    let state: HikeActivityAttributes.ContentState
    let title: String

    var body: some View {
        HStack(spacing: 12) {
            if let img = Self.loadSnapshot(state.snapshotName) {
                Image(uiImage: img)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: 96, height: 96)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .id(state.snapshotVersion) // force reload when the map changes
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(title).font(.headline).lineLimit(1).foregroundStyle(.white)
                HStack(spacing: 18) {
                    stat("Time", state.elapsed)
                    stat("Distance", state.distance)
                }
                if let remaining = state.remaining {
                    ProgressView(value: state.progress).tint(.green)
                    Text("\(remaining) to go")
                        .font(.caption).foregroundStyle(.white.opacity(0.7))
                }
            }
            Spacer(minLength: 0)
        }
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(.white.opacity(0.5))
            Text(value)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(.white)
        }
    }

    private static func loadSnapshot(_ name: String?) -> UIImage? {
        guard let name = name,
              let dir = FileManager.default
                .containerURL(forSecurityApplicationGroupIdentifier: "group.com.exploreus.app")
        else { return nil }
        return UIImage(contentsOfFile: dir.appendingPathComponent(name).path)
    }
}
