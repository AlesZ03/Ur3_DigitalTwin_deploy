import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Database, Clock, FileText, AlertCircle, Info } from 'lucide-react';
import { generateClient } from 'aws-amplify/api';
import NewLayout from './NewLayout';

// JAVÍTÁS: A klienst a komponensen kívül hozzuk létre, hogy elkerüljük a végtelen ciklust
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

  // Referenciák a stabil működéshez
  const lastLiveTimestampRef = useRef(0);
  const liveTimeoutRef = useRef(null);

  const API_URL = process.env.REACT_APP_API_URL;
  const COMMAND_API_URL = process.env.REACT_APP_COMMAND_API_URL;
  const QUICK_COMMAND_API_URL = process.env.REACT_APP_COMMAND_QUICK_API_URL;

  const fetchLogs = async (dateStr, startTimeStr, endTimeStr) => {
    setLoading(true);
    setError(null);
    setInfoMessage(null);

    if (!API_URL || API_URL.includes('your-api-id')) {
      setLoading(false);
      setError('Frontend not configured: please set REACT_APP_API_URL.');
      return;
    }

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
      console.error('Error fetching logs:', err);
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
    const subscriptionQuery = `
      subscription OnUr3ShadowUpdate {
        onUr3ShadowUpdate {
          state { reported { joint_positions timestamp } }
        }
      }
    `;

    const GET_INITIAL_STATE = `
      query GetInitialState {
        getLatestShadowUpdate {
          state { reported { joint_positions timestamp } }
        }
      }
    `;

    let hasReceivedSubscriptionData = false;

    const fetchInitialState = async () => {
      try {
        const response = await client.graphql({ query: GET_INITIAL_STATE });
        const initialShadow = response.data?.getLatestShadowUpdate;
        
        // JAVÍTÁS: Csak akkor fogadjuk el a Shadow-t, ha még nem jött frissebb adat a WebSocketen
        if (!hasReceivedSubscriptionData && initialShadow?.state?.reported?.joint_positions) {
          setRealtimeJointData(initialShadow.state.reported.joint_positions);
          setIsLive(true);
          setTimeout(() => setIsLive(false), 2000);
        }
      } catch (err) {
        console.warn("[AppSync] Shadow initial state error (normal if empty):", err);
      }
    };

    fetchInitialState();

    const subscription = client.graphql({ query: subscriptionQuery }).subscribe({
      next: ({ data }) => {
        const reported = data.onUr3ShadowUpdate?.state?.reported;
        if (reported?.joint_positions) {
          hasReceivedSubscriptionData = true;
          const msgTimestamp = reported.timestamp || 0;

          // JAVÍTÁS: Várkapus a rángatás ellen
          if (msgTimestamp >= lastLiveTimestampRef.current) {
            lastLiveTimestampRef.current = msgTimestamp;
            setRealtimeJointData(reported.joint_positions);
            
            setIsLive(true);
            if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);
            liveTimeoutRef.current = setTimeout(() => setIsLive(false), 3000);
          }
        }
      },
      error: (error) => console.error("[AppSync] Subscription error:", error)
    });

    return () => {
      subscription.unsubscribe();
      if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);
    };
  }, []); // JAVÍTÁS: Üres tömb, hogy ne fusson végtelen ciklusban

  const formatTimestamp = (log) => {
    if (!log.received_at) return 'Invalid Date';
    const date = new Date(log.received_at);
    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleString('hu-HU');
  };

  const sendCommand = async (command) => {
    setSending(true);
    try {
      const response = await fetch(COMMAND_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      const data = await response.json();
      if (data.success) {
        setCommandStatus({ type: 'success', message: 'Command sent!' });
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
      <div className="space-y-2">
        {rawJointData && (
          <div className="text-xs text-gray-300 font-mono">
            Raw: [{rawJointData.map(j => parseFloat(j).toFixed(4)).join(', ')}]
          </div>
        )}
        <details className="text-xs">
          <summary className="text-gray-400 cursor-pointer">View full JSON</summary>
          <pre className="mt-2 p-2 bg-black/30 rounded text-[10px]">{JSON.stringify(data, null, 2)}</pre>
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
            <h1 className="text-3xl font-bold">Robot Logs</h1>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Auto-refresh
            </label>
            <button onClick={() => fetchLogs()} className="px-3 py-1.5 bg-gray-800 rounded-lg text-sm border border-gray-700">
              <RefreshCw className={`w-4 h-4 inline mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {infoMessage && (
          <div className="mb-6 p-4 bg-blue-900/30 border border-blue-500 rounded-lg flex gap-3">
            <Info className="text-blue-400" />
            <div className="text-sm">{infoMessage}</div>
          </div>
        )}

        <NewLayout
          loading={loading} logs={logs} formatTimestamp={formatTimestamp}
          renderRobotData={renderRobotData} quickCommands={quickCommands}
          sendCommand={sendCommand} sending={sending} commandInput={commandInput}
          setCommandInput={setCommandInput} realtimeJointData={realtimeJointData}
          isLive={isLive} fetchReplayLogs={fetchLogs} 
        />
      </div>
    </div>
  );
}