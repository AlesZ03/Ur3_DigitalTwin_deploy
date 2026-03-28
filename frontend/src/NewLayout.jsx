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
    const s = new Date(`${date}T${startTime}:00`);
    const e = new Date(`${date}T${endTime}:00`);
    fetchReplayLogs(date, `${String(s.getUTCHours()).padStart(2,'0')}:${String(s.getUTCMinutes()).padStart(2,'0')}`, `${String(e.getUTCHours()).padStart(2,'0')}:${String(e.getUTCMinutes()).padStart(2,'0')}`);
    setProgress(0); setIsPlaying(false);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 mb-6 shadow-xl">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <div className="flex gap-4 items-end">
          <div className="space-y-1"><label className="text-[10px] text-gray-500 uppercase font-bold">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500" /></div>
          <div className="space-y-1"><label className="text-[10px] text-gray-500 uppercase font-bold">Start</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm outline-none" /></div>
          <div className="space-y-1"><label className="text-[10px] text-gray-500 uppercase font-bold">End</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm outline-none" /></div>
          <button onClick={handleFetch} className="h-9 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-bold transition">Load Replay</button>
          <button onClick={handleGoLive} className="h-9 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-bold border border-gray-600 flex items-center gap-2"><Activity className="w-4 h-4"/>Live</button>
        </div>
        <div className="flex items-center gap-3 bg-gray-900 p-1.5 rounded-lg border border-gray-700">
          <button onClick={() => setIsPlaying(!isPlaying)} disabled={logsCount === 0} className={`p-2 rounded-lg ${isPlaying ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>{isPlaying ? <Pause/> : <Play/>}</button>
          <div className="flex items-center gap-2 px-2 border-l border-gray-700"><FastForward className="w-4 h-4 text-gray-500"/>
            <select value={playbackSpeed} onChange={e => setPlaybackSpeed(Number(e.target.value))} className="bg-transparent text-sm outline-none cursor-pointer">
              <option value={0.5}>0.5x</option><option value={1}>1x</option><option value={2}>2x</option><option value={5}>5x</option><option value={10}>10x</option>
            </select>
          </div>
        </div>
      </div>
      {logsCount > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-4">
          <span className="text-xs font-mono text-gray-500">{progress}</span>
          <input type="range" min="0" max={logsCount - 1} value={progress} onChange={e => { setProgress(Number(e.target.value)); setIsPlaying(false); }} className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
          <span className="text-xs font-mono text-gray-500">{logsCount - 1}</span>
        </div>
      )}
    </div>
  );
};

function RobotModel({ jointData }) {
  const { scene, nodes } = useGLTF('/robot.glb'); 
  const jointRefs = React.useRef([]);
  const mapping = useMemo(() => [{n:'UR3',a:'y'},{n:'Shoulder',a:'z'},{n:'Elbow',a:'z'},{n:'Wrist01',a:'y'},{n:'Wrist02',a:'z'},{n:'Wrist03',a:'y'}], []);
  useEffect(() => { if (nodes) jointRefs.current = mapping.map(m => nodes[m.n]); }, [nodes, mapping]);
  useFrame(() => {
    if (jointData?.length === 6 && jointRefs.current.length === 6) {
      jointRefs.current.forEach((j, i) => { if (j) j.rotation[mapping[i].a] = THREE.MathUtils.lerp(j.rotation[mapping[i].a], jointData[i], 0.15); });
    }
  });
  return <primitive object={scene} scale={5} position={[0,-1,0]} />;
}

export default function NewLayout(props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [replayIndex, setReplayIndex] = useState(0);

  const chronologicalLogs = useMemo(() => [...props.logs].reverse(), [props.logs]);
  const isReplayMode = chronologicalLogs.length > 0 && (isPlaying || replayIndex > 0);
  const jointData = isReplayMode ? (chronologicalLogs[replayIndex]?.data?.corrected_joints || chronologicalLogs[replayIndex]?.data?.joint_positions) : props.realtimeJointData;

  useEffect(() => {
    let timer;
    if (isPlaying && chronologicalLogs.length > 1) {
      const next = (replayIndex + 1) % chronologicalLogs.length;
      let diff = (chronologicalLogs[next]?.data?.timestamp - chronologicalLogs[replayIndex]?.data?.timestamp) * 1000;
      if (diff < 0 || isNaN(diff)) diff = 100;
      if (diff > 5000) diff = 1000;
      timer = setTimeout(() => setReplayIndex(next), diff / playbackSpeed);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, replayIndex, chronologicalLogs, playbackSpeed]);

  return (
    <div className="flex flex-col gap-6">
      <ReplayControls {...props} isPlaying={isPlaying} setIsPlaying={setIsPlaying} playbackSpeed={playbackSpeed} setPlaybackSpeed={setPlaybackSpeed} progress={replayIndex} setProgress={setReplayIndex} logsCount={chronologicalLogs.length} handleGoLive={() => { setIsPlaying(false); setReplayIndex(0); props.fetchReplayLogs(); }} />
      
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2"><Activity className="text-purple-400"/> Digital Twin</h2>
          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${isReplayMode ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/50' : props.isLive ? 'bg-green-500/10 text-green-500 border-green-500/50' : 'bg-red-500/10 text-red-500 border-red-500/50'}`}>
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${props.isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            {isReplayMode ? 'REPLAY' : props.isLive ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>
        <div className="aspect-video bg-black/40 rounded-lg border border-gray-700 overflow-hidden">
          <Canvas camera={{ position: [0, 2, 5], fov: 45 }}><Suspense fallback={null}><ambientLight intensity={1.5}/><directionalLight position={[10,10,5]} intensity={2}/><RobotModel jointData={jointData}/><OrbitControls/><Preload all/></Suspense></Canvas>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 h-[500px] flex flex-col">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-gray-700 pb-2"><FileText className="text-blue-400"/> Activity Logs</h2>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {props.logs.length === 0 ? <div className="h-full flex items-center justify-center text-gray-500">No logs available</div> : 
              props.logs.map((log, i) => (
                <div key={i} className="bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
                  <div className="flex justify-between text-[10px] text-gray-500 mb-2 font-mono"><span>{props.formatTimestamp(log)}</span><span>{log.message_id?.slice(0,8)}</span></div>
                  {props.renderRobotData(log.data)}
                </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 h-[500px] flex flex-col">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-gray-700 pb-2"><Send className="text-green-400"/> Robot Control</h2>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <div className="grid grid-cols-2 gap-2">
              {props.quickCommands?.map((c, i) => <button key={i} onClick={() => props.sendCommand(c.command)} disabled={props.sending} className="py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold transition"> {c.label} </button>)}
            </div>
            <div className="pt-4 border-t border-gray-700 space-y-2">
              <label className="text-[10px] text-gray-500 font-bold uppercase">Custom JSON</label>
              <textarea value={props.commandInput} onChange={e => props.setCommandInput(e.target.value)} className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-xs font-mono h-24 outline-none focus:border-blue-500" placeholder='{"action": "move", ...}' />
              <button onClick={props.handleSendCustomCommand} disabled={props.sending || !props.commandInput.trim()} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold flex justify-center items-center gap-2"> {props.sending ? <RefreshCw className="animate-spin w-4 h-4"/> : <Send className="w-4 h-4"/>} Send Command </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}