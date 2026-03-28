import React, { useState, useEffect, Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { 
  RefreshCw, FileText, Send, Play, Pause, 
  FastForward, Clock, Calendar, Activity, Database 
} from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Preload } from '@react-three/drei';

// --- 1. REPLAY VEZÉRLŐK ---
const ReplayControls = ({ 
  fetchReplayLogs, isPlaying, setIsPlaying, playbackSpeed, 
  setPlaybackSpeed, progress, setProgress, logsCount, handleGoLive 
}) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');

  const handleFetch = () => {
    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);
    const utcStartTime = `${String(startDateTime.getUTCHours()).padStart(2, '0')}:${String(startDateTime.getUTCMinutes()).padStart(2, '0')}`;
    const utcEndTime = `${String(endDateTime.getUTCHours()).padStart(2, '0')}:${String(endDateTime.getUTCMinutes()).padStart(2, '0')}`;

    fetchReplayLogs(date, utcStartTime, utcEndTime);
    setProgress(0);
    setIsPlaying(false);
  };

  const isReplayActive = isPlaying || progress > 0;

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 mb-6 shadow-lg">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> Start</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> End</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
          </div>
          <button onClick={handleFetch} className="h-9 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">
            Load Replay
          </button>
          <button onClick={handleGoLive} className={`h-9 px-4 flex items-center gap-2 rounded-lg text-sm font-medium transition border ${isReplayActive ? 'bg-red-500/10 text-red-400 border-red-500/50' : 'bg-gray-700 text-gray-400 border-gray-600'}`}>
            <Activity className="w-4 h-4" /> Back to Live
          </button>
        </div>

        <div className="flex items-center gap-3 bg-gray-900 p-2 rounded-lg border border-gray-700">
          <button onClick={() => setIsPlaying(!isPlaying)} disabled={logsCount === 0} className={`p-2 rounded-full ${isPlaying ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'} transition`}>
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <select value={playbackSpeed} onChange={(e) => setPlaybackSpeed(Number(e.target.value))} className="bg-transparent text-sm text-gray-300 outline-none">
            <option value={0.5}>0.5x</option>
            <option value={1}>1x (Normal)</option>
            <option value={2}>2x</option>
            <option value={5}>5x</option>
            <option value={10}>10x</option>
          </select>
        </div>
      </div>
      {logsCount > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-4">
          <span className="text-xs text-gray-500 font-mono w-8 text-right">{progress}</span>
          <input type="range" min="0" max={logsCount - 1} value={progress} onChange={(e) => { setProgress(Number(e.target.value)); setIsPlaying(false); }} className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
          <span className="text-xs text-gray-500 font-mono w-8">{logsCount - 1}</span>
        </div>
      )}
    </div>
  );
};

// --- 2. 3D ROBOT MODELL ---
function RobotModel({ jointData, ...props }) {
  const { scene, nodes } = useGLTF('/robot.glb'); 
  const jointRefs = React.useRef([]);
  const JOINT_MAPPING = React.useMemo(() => [
    { name: 'UR3', axis: 'y' }, { name: 'Shoulder', axis: 'z' }, { name: 'Elbow', axis: 'z' },
    { name: 'Wrist01', axis: 'y' }, { name: 'Wrist02', axis: 'z' }, { name: 'Wrist03', axis: 'y' },
  ], []);

  React.useEffect(() => {
    if (nodes) jointRefs.current = JOINT_MAPPING.map(m => nodes[m.name]);
  }, [nodes, JOINT_MAPPING]);

  useFrame(() => {
    if (jointData && jointData.length === 6 && jointRefs.current.length === 6) {
      jointRefs.current.forEach((joint, index) => {
        if (joint) {
          joint.rotation[JOINT_MAPPING[index].axis] = THREE.MathUtils.lerp(
            joint.rotation[JOINT_MAPPING[index].axis], 
            jointData[index], 
            0.15 // Interpoláció a sima mozgásért
          );
        }
      });
    }
  });
  return <primitive object={scene} {...props} />;
}

// --- 3. DIGITAL TWIN PANEL ---
const DigitalTwinPanel = ({ jointData, isLive, isReplayMode }) => (
  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg mb-6">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-semibold flex items-center gap-2"><Activity className="text-purple-400"/> Digital Twin</h2>
      <div className={`px-3 py-1 rounded-full text-xs flex items-center gap-2 ${isReplayMode ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : isLive ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
        <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'bg-red-400'}`}></div>
        {isReplayMode ? 'Replay Mode' : isLive ? 'Live Stream' : 'Offline'}
      </div>
    </div>
    <div className="aspect-video bg-black/40 rounded-lg overflow-hidden border border-gray-700 relative">
      <Canvas camera={{ position: [0, 2, 5], fov: 50 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={1.5} /><directionalLight position={[10, 10, 5]} intensity={2} />
          <RobotModel scale={5} position={[0, -1, 0]} jointData={jointData} />
          <OrbitControls /><Preload all />
        </Suspense>
      </Canvas>
    </div>
  </div>
);

// --- 4. LOGS PANEL ---
const LogsPanel = ({ loading, logs, formatTimestamp, renderRobotData }) => (
  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 h-[600px] flex flex-col">
    <div className="flex items-center gap-2 mb-4 border-b border-gray-700 pb-2">
      <FileText className="w-5 h-5 text-blue-400" />
      <h2 className="text-xl font-semibold">Activity Logs</h2>
    </div>
    <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
      {loading && logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500"><RefreshCw className="animate-spin mb-2"/>Loading...</div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">No logs found</div>
      ) : (
        logs.map((log, index) => (
          <div key={log.key || index} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50 text-sm">
            <div className="flex justify-between text-gray-500 text-[10px] mb-2 font-mono">
              <span>{formatTimestamp(log)}</span>
              <span>{(log.size / 1024).toFixed(1)} KB</span>
            </div>
            {renderRobotData(log.data)}
          </div>
        ))
      )}
    </div>
  </div>
);

// --- 5. COMMAND PANEL ---
const CommandPanel = ({ quickCommands, sendCommand, sending, commandInput, setCommandInput, handleSendCustomCommand }) => (
  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 h-[600px] flex flex-col">
    <div className="flex items-center gap-2 mb-4 border-b border-gray-700 pb-2">
      <Send className="w-5 h-5 text-green-400" />
      <h2 className="text-xl font-semibold">Robot Control</h2>
    </div>
    <div className="space-y-6 overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-3">
        {quickCommands.map((cmd, i) => (
          <button key={i} onClick={() => sendCommand(cmd.command)} disabled={sending} className="py-3 px-4 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold transition disabled:opacity-50">
            {cmd.label}
          </button>
        ))}
      </div>
      <div className="pt-4 border-t border-gray-700">
        <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wider font-bold">Custom JSON Command</label>
        <textarea value={commandInput} onChange={(e) => setCommandInput(e.target.value)} placeholder='{"action": "move", "joints": [0,0,0,0,0,0]}' className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-xs font-mono outline-none focus:border-blue-500 h-32 mb-3" />
        <button onClick={handleSendCustomCommand} disabled={sending || !commandInput.trim()} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
          {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Command
        </button>
      </div>
    </div>
  </div>
);

// --- FŐ KOMPONENS ---
export default function NewLayout(props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [replayIndex, setReplayIndex] = useState(0);

  const chronologicalLogs = useMemo(() => [...props.logs].reverse(), [props.logs]);
  const isReplayMode = chronologicalLogs.length > 0 && (isPlaying || replayIndex > 0);

  const jointDataForModel = isReplayMode 
    ? chronologicalLogs[replayIndex]?.data?.corrected_joints || chronologicalLogs[replayIndex]?.data?.joint_positions
    : props.realtimeJointData;

  useEffect(() => {
    let timer;
    if (isPlaying && chronologicalLogs.length > 1) {
      const nextIndex = (replayIndex + 1) % chronologicalLogs.length;
      const currentTs = chronologicalLogs[replayIndex]?.data?.timestamp;
      const nextTs = chronologicalLogs[nextIndex]?.data?.timestamp;
      let diff = (nextTs - currentTs) * 1000;
      if (diff < 0 || isNaN(diff)) diff = 100;
      if (diff > 5000) diff = 1000;
      timer = setTimeout(() => setReplayIndex(nextIndex), diff / playbackSpeed);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, replayIndex, chronologicalLogs, playbackSpeed]);

  return (
    <div className="flex flex-col">
      <ReplayControls 
        {...props} isPlaying={isPlaying} setIsPlaying={setIsPlaying} 
        playbackSpeed={playbackSpeed} setPlaybackSpeed={setPlaybackSpeed} 
        progress={replayIndex} setProgress={setReplayIndex} logsCount={chronologicalLogs.length} 
        handleGoLive={() => { setIsPlaying(false); setReplayIndex(0); props.fetchReplayLogs(); }}
      />
      <DigitalTwinPanel jointData={jointDataForModel} isLive={props.isLive} isReplayMode={isReplayMode} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LogsPanel {...props} />
        <CommandPanel {...props} />
      </div>
    </div>
  );
}