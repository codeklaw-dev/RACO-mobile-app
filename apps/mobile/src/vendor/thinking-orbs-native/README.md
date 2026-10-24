# thinking-orbs-native (vendored)

The React Native port of [thinking-orbs](https://libraries.dev/orbs) by Jakub
Antalik, from
`packages/thinking-orbs/ports/react-native/thinking-orbs-native/src` in
<https://github.com/Jakubantalik/Libraries.dev> (MIT, see `LICENSE`). The port
isn't published to npm, so its source is copied here unchanged; the geometry
comes from the published `thinking-orbs` package's engine.

`ThinkingOrb.web.tsx` is ours: on web it renders the `thinking-orbs` canvas
component instead of Skia, for the browser preview.
