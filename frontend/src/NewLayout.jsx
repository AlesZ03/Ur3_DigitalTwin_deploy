import React, { Suspense } from 'react';
import * as THREE from 'three';
import { RefreshCw, FileText, Send } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Preload } from '@react-three/drei';

const LogsPanel = ({ loading, logs, formatTimestamp, renderRobotData }) => {
  if (loading && logs.length === 0) {
    return (
      <div>
        <div className="text-center py-20 bg-gray-800 rounded-xl border border-gray-700">
          <RefreshCw className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading logs...</p>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div>
        <div className="text-center py-20 bg-gray-800 rounded-xl border border-gray-700">
          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-xl text-gray-400 mb-2">No logs found</p>
          <p className="text-sm text-gray-500">Try selecting a different date or wait for robot data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <div className="space-y-4">
        {logs.map((log, index) => (
          <div key={log.key || index} className="bg-gray-900 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-sm text-gray-400">{formatTimestamp(log)}</div>
                {log.message_id && <div className="text-xs text-gray-500 font-mono mt-1">ID: {log.message_id}</div>}
              </div>
              <div className="text-xs text-gray-500">{(log.size / 1024).toFixed(2)} KB</div>
            </div>
            {renderRobotData(log.data)}
            <div className="mt-3 text-xs text-gray-500 opacity-75">S3 Key: {log.key}</div>
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
            className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition text-sm"
          >
            {cmd.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-sm text-gray-400">Custom JSON Command</label>
        <textarea
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          placeholder='{"action": "move", "x": 100, "y": 50}'
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
          rows="4"
          disabled={sending}
        />
        <button
          onClick={handleSendCustomCommand}
          disabled={sending || !commandInput.trim()}
          className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition flex items-center justify-center gap-2"
        >
          {sending ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send Command
            </>
          )}
        </button>
      </div>
    </div>
  </div>
);

function RobotModel({ jointData, ...props }) {
  const { scene, nodes } = useGLTF('/robot.glb'); // Győződj meg róla, hogy a modell a public mappában van
  const jointRefs = React.useRef([]);

  React.useEffect(() => {
    if (nodes) {
      // FONTOS: Ezeknek a neveknek PONTOSAN meg kell egyezniük a .glb fájlban lévő csuklók (joint/bone) neveivel.
      // Ha a modell nem mozog, ellenőrizd a neveket a GLB fájlban (pl. a https://gltf-viewer.donmccurdy.com/ oldalon)
      // és frissítsd ezt a listát. A 'shoulder_pan_joint' és 'shoulder_lift_joint' a leggyakoribb nevek.
      const jointNames = [
        'UR3',      // 1. Váll forgatás (pan)
        'Shoulder', // 2. Váll emelés (lift)
        'Elbow',    // 3. Könyök
        'Wrist01',  // 4. Csukló 1
        'Wrist02',  // 5. Csukló 2
        'Wrist03'   // 6. Csukló 3
      ];
      jointRefs.current = jointNames.map(name => nodes[name]);

      // Hibakeresés: Kiírjuk, melyik nevet nem találtuk meg
      jointRefs.current.forEach((ref, index) => {
        if (!ref) {
          console.warn(`A(z) '${jointNames[index]}' nevű csuklót nem sikerült megtalálni a 3D modellben! Lehetséges nevek:`, Object.keys(nodes));
        }
      });
    }
  }, [nodes]);

  // A useFrame hook minden egyes képkocka renderelésekor lefut.
  // Itt valósítjuk meg a csuklók animációját.
  useFrame(() => {
    // Csak akkor animálunk, ha van érvényes jointData (6 csukló adatával)

    // EZ A LOG MEGMUTATJA, HOGY A 3D MODELL MEGAKAPJA-E AZ ADATOT AZ ANIMÁCIÓHOZ
    if (jointData) console.log("%c[3D Model] Received jointData for animation:", "color: #ff9900;", jointData);

    if (jointData && jointData.length === 6 && jointRefs.current.length === 6) {
      jointRefs.current.forEach((joint, index) => {
        if (joint) {
          const value = jointData[index];
          // A `lerp` (lineáris interpoláció) finom, animált mozgást biztosít.
          switch (index) {
            case 0: // UR3 (pan)
              joint.rotation.y = THREE.MathUtils.lerp(joint.rotation.y, value, 0.1);
              break;
            case 1: // Shoulder (lift)
              joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, value + Math.PI / 2, 0.1);
              break;
            case 2: // Elbow
              joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, value, 0.1);
              break;
            case 3: // Wrist01
              joint.rotation.y = THREE.MathUtils.lerp(joint.rotation.y, value, 0.1);
              break;
            case 4: // Wrist02
              joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, value, 0.1);
              break;
            case 5: // Wrist03
              joint.rotation.y = THREE.MathUtils.lerp(joint.rotation.y, value, 0.1);
              break;
            default:
              break;
          }
        }
      });
    }
  });

  // A `scene` objektumot rendereljük, aminek a belső részeit (a csuklókat) a useFrame hook mozgatja.
  return <primitive object={scene} {...props} />;
}

const DigitalTwinPanel = ({ jointData }) => (
  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
    <div className="flex items-center gap-2 mb-4">
      {/* Egy egyszerű ikon a Digital Twin-hez */}
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="m12 9-3 5h6l-3-5Z"/></svg>
      <h2 className="text-xl font-semibold">Digital Twin</h2>
    </div>
    <div className="aspect-video bg-gray-900 rounded-lg border border-gray-700">
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
}) {
  // A mozgáshoz a valós idejű WebSocket adatot használjuk, ha van,
  // egyébként fallbackelünk a legutolsó logban lévő adatra.
  const jointDataForModel = realtimeJointData || logs[0]?.data?.joints;

  return (
    <div className="flex flex-col gap-6 mt-8">
      {/* Felső szekció: Digital Twin */}
      <DigitalTwinPanel jointData={jointDataForModel} />

      {/* Alsó szekció: Logok és Parancsok */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bal oszlop: Logok */}
        <div>
          <LogsPanel
            loading={loading}
            logs={logs}
            formatTimestamp={formatTimestamp}
            renderRobotData={renderRobotData}
          />
        </div>
        {/* Jobb oszlop: Parancsok */}
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
