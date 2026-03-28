import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Database, Clock, FileText, AlertCircle, Info } from 'lucide-react';
import { generateClient } from 'aws-amplify/api';
import NewLayout from './NewLayout';

// Klienst a komponensen kívül hozzuk létre a végtelen ciklus elkerülésére
const client = generateClient();

export default function RobotLogsDashboard() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [commandInput, setCommandInput] = useState('');
  const [sending, setSending] = useState(false);
  const [commandStatus, setCommandStatus] = useState(null);
  const [realtimeJointData, setRealtimeJointData] = useState(null);
  const [quickCommands, setQuickCommands] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const [infoMessage, setInfoMessage] = useState(null);

  const lastLiveTimestampRef = useRef(0);
  const liveTimeoutRef = useRef(null);

  const API_URL = process.env.REACT_APP_API_URL;
  const COMMAND_API_URL = process.env.REACT_APP_COMMAND_API_URL;
  const QUICK_COMMAND_API_URL = process.env.REACT_APP_COMMAND_QUICK_API_URL;

  // Quick Commands lekérése
  useEffect(() => {
    const fetchQuickCommands = async () => {
      if (!QUICK_COMMAND_API_URL || QUICK_COMMAND_API_URL.includes('your-api-id')) return;
      try {
        const response = await fetch(QUICK_COMMAND_API_URL);
        if (response.ok) {
          const commands = await response.json();
          setQuickCommands(commands);
        }
      } catch (err) {
        console.error("Error fetching quick commands:", err);
      }
    };
    fetchQuickCommands();
  }, [QUICK_COMMAND_API_URL]);

  const fetchLogs = async (dateStr, startTimeStr, endTimeStr) => {
    setLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      const targetDate = dateStr || new Date().toISOString().split('T')[0];
      const dateParam = targetDate.replace(/-/g, '/');
      let url = `${API_URL}?date=${dateParam}&order=desc`;

      if (startTimeStr && endTimeStr) {
        url += `&startTime=${startTimeStr}&endTime=${endTimeStr}`;
        setAutoRefresh(false);
      } else {
        url += `&limit=50`;
        setAutoRefresh(true);
      }
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      if (data && data.logs !== undefined) {
        setLogs(data.logs || []);
        setInfoMessage(data.info_message || null);
      } else {
        setLogs(Array.isArray(data) ? data : []);
      }
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchLogs(), 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  useEffect(() => {
    const subscriptionQuery = `subscription OnUr3ShadowUpdate { onUr3ShadowUpdate { state { reported { joint_positions timestamp } } } }`;
    const GET_INITIAL_STATE = `query GetInitialState { getLatestShadowUpdate { state { reported { joint_positions timestamp } } } }`;

    let hasReceivedSubscriptionData = false;

    const fetchInitialState = async () => {
      try {
        const response = await client.graphql({ query: GET_INITIAL_STATE });
        const initialShadow = response.data?.getLatestShadowUpdate;
        if (!hasReceivedSubscriptionData && initialShadow?.state?.reported?.joint_positions) {
          setRealtimeJointData(initialShadow.state.reported.joint_positions);
          // Indításkor NEM váltunk Live-ra (piros marad), csak betöltjük a pózt
        }
      } catch (err) {
        console.warn("[AppSync] Shadow empty or error.");
      }
    };

    fetchInitialState();

    const subscription = client.graphql({ query: subscriptionQuery }).subscribe({
      next: ({ data }) => {
        const reported = data.onUr3ShadowUpdate?.state?.reported;
        if (reported?.joint_positions) {
          hasReceivedSubscriptionData = true;
          const msgTimestamp = reported.timestamp || 0;

          if (msgTimestamp >= lastLiveTimestampRef.current) {
            lastLiveTimestampRef.current = msgTimestamp;
            setRealtimeJointData(reported.joint_positions);
            
            setIsLive(true);
            if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);
            liveTimeoutRef.current = setTimeout(() => setIsLive(false), 3000);
          }
        }
      },
      error: (error) => setIsLive(false)
    });

    return () => {
      subscription.unsubscribe();
      if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);
    };
  }, []);

  const sendCommand = async (command) => {
    setSending(true);
    setCommandStatus(null);
    try {
      const response = await fetch(COMMAND_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      const data = await response.json();
      if (data.success) {
        setCommandStatus({ type: 'success', message: 'Command sent successfully!' });
        setTimeout(() => setCommandStatus(null), 5000);
      }
    } catch (err) {
      setCommandStatus({ type: 'error', message: err.message });
    } finally {
      setSending(false);
    }
  };

  const renderRobotData = (data) => {
    const rawJointData = data.joint_positions || data.joints;
    return (
      <div className="space-y-1">
        {rawJointData && (
          <div className="text-[11px] text-gray-300 font-mono">
            RAW: [{rawJointData.map(j => parseFloat(j).toFixed(3)).join(', ')}]
          </div>
        )}
        <details className="text-[10px] text-gray-500">
          <summary className="cursor-pointer hover:text-gray-300">Expand JSON</summary>
          <pre className="mt-1 p-1 bg-black/20 rounded">{JSON.stringify(data, null, 2)}</pre>
        </details>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <Database className="w-10 h-10 text-blue-400" />
            <div>
              <h1 className="text-3xl font-bold">Robot Control Center</h1>
              <p className="text-gray-400 text-sm">Industrial UR3 Digital Twin</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="accent-blue-500" />
              Auto-refresh
            </label>
            <button onClick={() => fetchLogs()} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition">
              <RefreshCw className={`w-4 h-4 inline mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {(error || infoMessage || commandStatus) && (
          <div className="space-y-3 mb-6">
            {infoMessage && <div className="p-4 bg-blue-900/20 border border-blue-500/50 rounded-lg text-blue-200 text-sm flex gap-3"><Info/>{infoMessage}</div>}
            {error && <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-200 text-sm flex gap-3"><AlertCircle/>{error}</div>}
            {commandStatus && <div className={`p-4 border rounded-lg text-sm ${commandStatus.type === 'success' ? 'bg-green-900/20 border-green-500/50 text-green-200' : 'bg-red-900/20 border-red-500/50 text-red-200'}`}>{commandStatus.message}</div>}
          </div>
        )}

        <NewLayout
          {...{loading, logs, realtimeJointData, isLive, quickCommands, sending, commandInput}}
          formatTimestamp={(log) => new Date(log.received_at).toLocaleString('hu-HU')}
          renderRobotData={renderRobotData}
          sendCommand={sendCommand}
          setCommandInput={setCommandInput}
          handleSendCustomCommand={() => { try { sendCommand(JSON.parse(commandInput)); setCommandInput(''); } catch(e) { alert("Invalid JSON"); } }}
          fetchReplayLogs={fetchLogs}
        />
      </div>
    </div>
  );
}