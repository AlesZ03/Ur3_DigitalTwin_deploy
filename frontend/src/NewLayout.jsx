import React, { useState, useEffect, Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { RefreshCw, FileText, Send, Play, Pause, FastForward, Clock, Calendar, Activity } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Preload } from '@react-three/drei';

const ReplayControls = ({ fetchReplayLogs, isPlaying, setIsPlaying, playbackSpeed, setPlaybackSpeed, progress, setProgress, logsCount, handleGoLive }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');

  const handleFetch = () => {
    // JAVÍTÁS: Időzóna korrekció UTC-re
    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);
    const utcStartTime = `${String(startDateTime.getUTCHours()).padStart(2, '0')}:${String(startDateTime.getUTCMinutes()).padStart(2, '0')}`;
    const utcEndTime = `${String(endDateTime.getUTCHours()).padStart(2, '0')}:${String(endDateTime.getUTCMinutes()).padStart(2, '0')}`;

    fetchReplayLogs(date, utcStartTime, utcEndTime);
    setProgress(0);
    setIsPlaying(false);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 mb-6 shadow-lg">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <div className="flex gap-4 items-end">
          <div><label className="block text-xs text-gray-400 mb-1">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white" /></div>
          <div><label className="block text-xs text-gray-400 mb-1">Start</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white" /></div>
          <div><label className="block text-xs text-gray-400 mb-1">End</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white" /></div>
          <button onClick={handleFetch} className="h-9 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition">Load Replay</button>
          <button onClick={handleGoLive} className="h-9 px-4 flex items-center gap-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 border border-gray-600 transition"><Activity className="w-4 h-4" />Back to Live</button>
        </div>
        <div className="flex items-center gap-3 bg-gray-900 p-2 rounded-lg border border-gray-700">
          <button onClick={() => setIsPlaying(!isPlaying)} disabled={logsCount === 0} className={`p-2 rounded-full ${isPlaying ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <select value={playbackSpeed} onChange={e => setPlaybackSpeed(Number(e.target.value))} className="bg-transparent text-sm text-gray-300 outline-none">
            <option value={0.5}>0.5x</option><option value={1}>1x</option><option value={2}>2x</option><option value={5}>5x</option>
          </select>
        </div>
      </div>
      {logsCount > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-4">
          <span className="text-xs text-gray-500 font-mono w-6 text-right">{progress}</span>
          <input type="range" min="0" max={logsCount - 1} value={progress} onChange={e => { setProgress(Number(e.target.value)); setIsPlaying(false); }} className="flex-1 h-2 bg-gray-700 rounded-lg cursor-pointer accent-blue-500" />
          <span className="text-xs text-gray-500 font-mono w-6">{logsCount - 1}</span>
        </div>
      )}
    </div>
  );
};

// RobotModel és LiveIndicator komponensek változatlanok...
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
        if (joint) joint.rotation[JOINT_MAPPING[index].axis] = THREE.MathUtils.lerp(joint.rotation[JOINT_MAPPING[index].axis], jointData[index], 0.15);
      });
    }
  });
  return <primitive object={scene} {...props} />;
}

const DigitalTwinPanel = ({ jointData, isLive, isReplayMode }) => (
  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-semibold flex items-center gap-2"><Activity className="text-purple-400"/> Digital Twin</h2>
      <div className={`px-3 py-1 rounded-full text-xs flex items-center gap-2 ${isReplayMode ? 'bg-yellow-500/20 text-yellow-400' : isLive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
        <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
        {isReplayMode ? 'Replay Mode' : isLive ? 'Live Stream' : 'Offline'}
      </div>
    </div>
    <div className="aspect-video bg-black/40 rounded-lg overflow-hidden border border-gray-700">
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

export default function NewLayout({ logs, loading, formatTimestamp, renderRobotData, realtimeJointData, isLive, fetchReplayLogs }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [replayIndex, setReplayIndex] = useState(0);

  const chronologicalLogs = useMemo(() => [...logs].reverse(), [logs]);
  const isReplayMode = chronologicalLogs.length > 0 && (isPlaying || replayIndex > 0);

  // JAVÍTÁS: Intelligens adatforrás kiválasztás
  const jointDataForModel = isReplayMode 
    ? chronologicalLogs[replayIndex]?.data?.corrected_joints || chronologicalLogs[replayIndex]?.data?.joint_positions
    : realtimeJointData; // Élőben sima tömb jön az AppSync-től

  useEffect(() => {
    let timer;
    if (isPlaying && chronologicalLogs.length > 1) {
      const nextIndex = (replayIndex + 1) % chronologicalLogs.length;
      const currentTs = chronologicalLogs[replayIndex]?.data?.timestamp;
      const nextTs = chronologicalLogs[nextIndex]?.data?.timestamp;
      let diff = (nextTs - currentTs) * 1000;
      if (diff < 0 || isNaN(diff)) diff = 100;
      if (diff > 5000) diff = 1000; // Loopback védelem
      
      timer = setTimeout(() => setReplayIndex(nextIndex), diff / playbackSpeed);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, replayIndex, chronologicalLogs, playbackSpeed]);

  return (
    <div className="flex flex-col gap-6">
      <ReplayControls 
        fetchReplayLogs={fetchReplayLogs} isPlaying={isPlaying} setIsPlaying={setIsPlaying} 
        playbackSpeed={playbackSpeed} setPlaybackSpeed={setPlaybackSpeed} 
        progress={replayIndex} setProgress={setReplayIndex} logsCount={chronologicalLogs.length} 
        handleGoLive={() => { setIsPlaying(false); setReplayIndex(0); fetchReplayLogs(); }}
      />
      <DigitalTwinPanel jointData={jointDataForModel} isLive={isLive} isReplayMode={isReplayMode} />
      {/* LogsPanel és CommandPanel helye... */}
    </div>
  );
}