import React, { useState, useEffect, Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { RefreshCw, FileText, Send, Play, Pause, FastForward, Clock, Calendar } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Preload } from '@react-three/drei';

// --- ÚJ: IDŐGÉP VEZÉRLŐPANEL ---
const ReplayControls = ({ 
  fetchReplayLogs, 
  isPlaying, 
  setIsPlaying, 
  playbackSpeed, 
  setPlaybackSpeed, 
  progress, 
  setProgress,
  logsCount
}) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');

  const handleFetch = () => {
    fetchReplayLogs(date, startTime, endTime);
    setProgress(0);
    setIsPlaying(false);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 mb-6 shadow-lg shadow-black/20">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        
        {/* Dátum és Idő választók */}
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> Start Time</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> End Time</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
          </div>
          <button onClick={handleFetch} className="h-9 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition shadow-md">
            Load Replay Data
          </button>
        </div>

        {/* Lejátszó vezérlők */}
        <div className="flex items-center gap-3 bg-gray-900 p-2 rounded-lg border border-gray-700 shadow-inner">
          <button 
            onClick={() => setIsPlaying(!isPlaying)} 
            disabled={logsCount === 0}
            className={`p-2 rounded-full ${isPlaying ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'} disabled:opacity-50 transition`}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          
          <div className="flex items-center gap-2 border-l border-gray-700 pl-3">
            <FastForward className="w-4 h-4 text-gray-400" />
            <select 
              value={playbackSpeed} 
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="bg-transparent text-sm text-gray-300 outline-none cursor-pointer"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x (Normal)</option>
              <option value={2}>2x</option>
              <option value={5}>5x</option>
              <option value={10}>10x</option>
            </select>
          </div>
        </div>

      </div>

      {/* Folyamatjelző csúszka */}
      {logsCount > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-4">
          <span className="text-xs text-gray-500 font-mono w-6 text-right">{progress}</span>
          <input 
            type="range" 
            min="0" 
            max={logsCount - 1} 
            value={progress}
            onChange={(e) => {
              setProgress(Number(e.target.value));
              setIsPlaying(false); // Megállítjuk a lejátszást amíg húzogatja
            }}
            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="text-xs text-gray-500 font-mono w-6">{logsCount - 1}</span>
        </div>
      )}
    </div>
  );
};

// --- MEGLÉVŐ KOMPONENSEK (Változatlanul) ---
const LogsPanel = ({ loading, logs, formatTimestamp, renderRobotData }) => {
  if (loading && logs.length === 0) {
    return (
      <div className="text-center py-20 bg-gray-800 rounded-xl border border-gray-700">
        <RefreshCw className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Loading logs...</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-20 bg-gray-800 rounded-xl border border-gray-700">
        <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-xl text-gray-400 mb-2">No logs found</p>
        <p className="text-sm text-gray-500">Try selecting a different date or wait for robot data</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 max-h-[600px] overflow-y-auto">
      <div className="flex items-center gap-2 mb-4 sticky top-0 bg-gray-800 pb-2 border-b border-gray-700 z-10">
        <FileText className="w-5 h-5 text-blue-400" />
        <h2 className="text-xl font-semibold">Activity Logs</h2>
      </div>
      <div className="space-y-4">
        {logs.map((log, index) => (
          <div key={log.key || index} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-sm text-gray-400">{formatTimestamp(log)}</div>
                {log.message_id && <div className="text-xs text-gray-500 font-mono mt-1">ID: {log.message_id}</div>}
              </div>
              <div className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                {(log.size / 1024).toFixed(2)} KB
              </div>
            </div>
            {renderRobotData(log.data)}
          </div>
        ))}
      </div>
    </div>
  );
};

const CommandPanel = ({ quickCommands, sendCommand, sending, commandInput, setCommandInput, handleSendCustomCommand }) => (
  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
    <div className="flex items-center gap-2 mb-4">
      <Send className="w-5 h-5 text-blue-400" />
      <h2 className="text-xl font-semibold">Send Commands</h2>
    </div>

    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {quickCommands.map((cmd, i) => (
          <button
            key={i}
            onClick={() => sendCommand(cmd.command)}
            disabled={sending}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition text-sm shadow-md"
          >
            {cmd.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 pt-4 border-t border-gray-700">
        <label className="text-sm text-gray-400">Custom JSON Command</label>
        <textarea
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          placeholder='{"action": "move", "joints": [0, -1.57, 0, -1.57, 0, 0]}'
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm shadow-inner"
          rows="4"
          disabled={sending}
        />
        <button
          onClick={handleSendCustomCommand}
          disabled={sending || !commandInput.trim()}
          className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition flex items-center justify-center gap-2 shadow-md"
        >
          {sending ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Sending...</>
          ) : (
            <><Send className="w-4 h-4" /> Send Command</>
          )}
        </button>
      </div>
    </div>
  </div>
);

function RobotModel({ jointData, ...props }) {
  const { scene, nodes } = useGLTF('/robot.glb'); 
  const jointRefs = React.useRef([]);

  const JOINT_MAPPING = React.useMemo(() => [
    { name: 'UR3',      axis: 'y' },
    { name: 'Shoulder', axis: 'z' },
    { name: 'Elbow',    axis: 'z' },
    { name: 'Wrist01',  axis: 'y' },
    { name: 'Wrist02',  axis: 'z' },
    { name: 'Wrist03',  axis: 'y' },
  ], []);

  React.useEffect(() => {
    if (nodes) {
      jointRefs.current = JOINT_MAPPING.map(mapping => nodes[mapping.name]);
    }
  }, [nodes, JOINT_MAPPING]);

  useFrame(() => {
    if (jointData && jointData.length === 6 && jointRefs.current.length === 6) {
      jointRefs.current.forEach((joint, index) => {
        if (joint) {
          const mapping = JOINT_MAPPING[index];
          const targetRotation = jointData[index];
          
          joint.rotation[mapping.axis] = THREE.MathUtils.lerp(
            joint.rotation[mapping.axis], 
            targetRotation, 
            0.15 // Kicsit gyorsabb lerp, hogy responzívabb legyen a tekerésnél
          );
        }
      });
    }
  });

   return <primitive object={scene} {...props} />;
}

const LiveIndicator = ({ isLive, isReplayMode }) => {
  if (isReplayMode) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium border border-yellow-500/30">
        <Clock className="w-3 h-3" />
        Replay Mode
      </div>
    );
  }
  if (isLive) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium border border-green-500/30">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"></div>
        Live Stream
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-medium border border-red-500/30">
      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
      Offline
    </div>
  );
};

const DigitalTwinPanel = ({ jointData, isLive, isReplayMode }) => (
  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="m12 9-3 5h6l-3-5Z"/></svg>
        <h2 className="text-xl font-semibold">Digital Twin</h2>
      </div>
      <LiveIndicator isLive={isLive} isReplayMode={isReplayMode} />
    </div>
    <div className="aspect-video bg-gray-900 rounded-lg border border-gray-700 shadow-inner overflow-hidden">
      <Canvas camera={{ position: [0, 2, 5], fov: 50 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={1.5} />
          <directionalLight position={[10, 10, 5]} intensity={2} />
          <RobotModel scale={5} position={[0, -1, 0]} jointData={jointData} />
          <OrbitControls />
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  </div>
);


export default function NewLayout({
  loading,
  logs,
  formatTimestamp,
  renderRobotData,
  quickCommands,
  sendCommand,
  sending,
  commandInput,
  setCommandInput,
  handleSendCustomCommand,
  realtimeJointData,
  isLive,
  fetchReplayLogs, // Megkapja az App.jsx-ből
}) {

  // --- LEJÁTSZÓ MOTOR ÁLLAPOTOK ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [replayIndex, setReplayIndex] = useState(0);

  // A backend csökkenő (desc) sorrendben adja a logokat. 
  // A lejátszáshoz meg kell fordítanunk, hogy időrendben (asc) haladjunk.
  const chronologicalLogs = useMemo(() => {
    return [...logs].reverse();
  }, [logs]);

  // A tényleges lejátszó logika
  useEffect(() => {
    let timer;
    if (isPlaying && chronologicalLogs.length > 0 && replayIndex < chronologicalLogs.length - 1) {
      const currentLog = chronologicalLogs[replayIndex];
      const nextLog = chronologicalLogs[replayIndex + 1];
      
      // Kiszámoljuk az eltelt időt a két log között másodpercben, majd átváltjuk ms-re
      let diffMs = (nextLog.data.timestamp - currentLog.data.timestamp) * 1000;
      
      // Biztosíték: Ha rossz a timestamp vagy túl nagy a szakadék (pl. 1 óra), maximalizáljuk a várakozást
      if (diffMs < 0 || isNaN(diffMs)) diffMs = 100;
      if (diffMs > 5000) diffMs = 5000; // Max 5 mp várakozás, ne álljon le teljesen
      
      // Alkalmazzuk a felhasználó által választott sebességet
      const timeoutMs = diffMs / playbackSpeed;

      timer = setTimeout(() => {
        setReplayIndex(prev => prev + 1);
      }, timeoutMs);
      
    } else if (replayIndex >= chronologicalLogs.length - 1 && isPlaying) {
      // Ha a végére értünk, megáll a lejátszás
      setIsPlaying(false); 
    }
    
    return () => clearTimeout(timer);
  }, [isPlaying, replayIndex, chronologicalLogs, playbackSpeed]);


  // --- DÖNTÉS: ÉLŐ VAGY VISSZAJÁTSZÁS ---
  // Ha elmozdítottuk a csúszkát 0-ról, vagy épp megy a lejátszás, akkor Replay módban vagyunk
  const isReplayMode = chronologicalLogs.length > 0 && (isPlaying || replayIndex > 0);
  
  // A modell az alapján kap adatot, hogy melyik módban vagyunk
  const jointDataForModel = isReplayMode 
    ? chronologicalLogs[replayIndex]?.data?.joint_positions || chronologicalLogs[replayIndex]?.data?.joints
    : realtimeJointData;

  return (
    <div className="flex flex-col gap-6">
      
      {/* 1. Az Időgép Vezérlőpanelje */}
      <ReplayControls 
        fetchReplayLogs={fetchReplayLogs}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        playbackSpeed={playbackSpeed}
        setPlaybackSpeed={setPlaybackSpeed}
        progress={replayIndex}
        setProgress={setReplayIndex}
        logsCount={chronologicalLogs.length}
      />

      {/* 2. Digital Twin (Módosítva, hogy jelezze a Replay módot) */}
      <DigitalTwinPanel 
        jointData={jointDataForModel} 
        isLive={isLive} 
        isReplayMode={isReplayMode}
      />

      {/* 3. Alsó Szekciók */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <LogsPanel
            loading={loading}
            logs={logs}
            formatTimestamp={formatTimestamp}
            renderRobotData={renderRobotData}
          />
        </div>
        <div>
          <CommandPanel
            quickCommands={quickCommands}
            sendCommand={sendCommand}
            sending={sending}
            commandInput={commandInput}
            setCommandInput={setCommandInput}
            handleSendCustomCommand={handleSendCustomCommand}
          />
        </div>
      </div>
    </div>
  );
}