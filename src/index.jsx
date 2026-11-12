import { registerRoot, Composition } from 'remotion';
import { Clip } from './Clip.jsx';
const Root = () => (
  <Composition id="Clip" component={Clip} width={1080} height={1920} fps={30}
    durationInFrames={300}
    defaultProps={{ src: '', hook: 'Hook goes here', words: [], credit: '', duration: 10, layout: 'fit' }}
    calculateMetadata={({ props }) => ({ durationInFrames: Math.max(30, Math.round((props.duration || 10) * 30)) })} />
);
registerRoot(Root);
