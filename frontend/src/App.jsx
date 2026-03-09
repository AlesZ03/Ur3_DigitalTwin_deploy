import React, { useState, useEffect } from 'react';
import { RefreshCw, Database, Clock, FileText, AlertCircle, Send } from 'lucide-react';
import { generateClient } from 'aws-amplify/api';
import NewLayout from './NewLayout';

export default function RobotLogsDashboard() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [commandInput, setCommandInput] = useState('');
  const [sending, setSending] = useState(false);
  const [commandStatus, setCommandStatus] = useState(null);
  const [realtimeJointData, setRealtimeJointData] = useState(null);
  const [quickCommands, setQuickCommands] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const liveTimeoutRef = React.useRef(null);

  const client = generateClient();

  const API_URL = process.env.REACT_APP_API_URL ;
  const COMMAND_API_URL = process.env.REACT_APP_COMMAND_API_URL ;
  const QUICK_COMMAND_API_URL = process.env.REACT_APP_COMMAND_QUICK_API_URL;

  const fetchLogs = async (date = selectedDate) => {
    setLoading(true);
    setError(null);

    if (!API_URL || API_URL.includes('your-api-id')) {
      setLoading(false);
      setError('Frontend not configured: please set REACT_APP_API_URL and rebuild.');
      return;
    }

    try {
      const dateParam = date.replace(/-/g, '/');

     const response = await fetch(`${API_URL}?date=${dateParam}&limit=50&order=desc`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      setLogs(data || []); 
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
  }, [selectedDate]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 10000); 
    return () => clearInterval(interval);
  }, [autoRefresh, selectedDate]);

  useEffect(() => {
    const fetchQuickCommands = async () => {
      if (!QUICK_COMMAND_API_URL || QUICK_COMMAND_API_URL.includes('your-api-id')) {
        console.warn("QUICK_COMMAND_API_URL not configured, quick commands will not be available.");
        return;
      }
      try {
        const response = await fetch(QUICK_COMMAND_API_URL);
        if (!response.ok) {
          throw new Error(`Failed to fetch quick commands: ${response.status}`);
        }
        const commands = await response.json();
        setQuickCommands(commands);
      } catch (err) {
        console.error("Error fetching quick commands:", err);
      }
    };
    fetchQuickCommands();
  }, [QUICK_COMMAND_API_URL]);

  useEffect(() => {
    const subscriptionQuery = /* GraphQL */ `
      subscription OnUr3ShadowUpdate {
        onUr3ShadowUpdate {
          state {
            reported {
              joint_positions
              timestamp
            }
          }
          version
        }
      }
    `;

    const GET_INITIAL_STATE = /* GraphQL */ `
      query GetInitialState {
        getLatestShadowUpdate {
          state {
            reported {
              joint_positions
            }
          }
        }
      }
    `;

   
    const fetchInitialState = async () => {
      try {
        const response = await client.graphql({
          query: GET_INITIAL_STATE
        });
        
        const initialShadow = response.data.getLatestShadowUpdate;
        console.log("[AppSync] Initial state from Shadow:", initialShadow);

        if (initialShadow?.state?.reported?.joint_positions) {
          setRealtimeJointData(initialShadow.state.reported.joint_positions);

          setTimeout(() => setIsLive(false), 2000);
        }
      } catch (err) {
        console.error("[AppSync] Error fetching initial shadow:", err);
      }
    };


    fetchInitialState();
 

    const subscription = client.graphql({
      query: subscriptionQuery
    }).subscribe({
      next: ({ data }) => {
        const shadowData = data.onUr3ShadowUpdate;
        
        if (shadowData?.state?.reported?.joint_positions) {
          setRealtimeJointData(shadowData.state.reported.joint_positions);
          
          
          const msgTimestamp = shadowData.state.reported.timestamp;
          const now = Date.now() / 1000;

          if (now - msgTimestamp < 5) {
            setIsLive(true);
            if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);
           
            liveTimeoutRef.current = setTimeout(() => setIsLive(false), 3000);
          } else {
            setIsLive(false);
          }
        }
      },
      error: (error) => {
        console.error("[AppSync] Subscription error:", error);
        setIsLive(false);
      },
    });
    return () => {
      subscription.unsubscribe();
      if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);
    };
  }, []); 


  const formatTimestamp = (log) => {
       if (!log.received_at) return 'Invalid Date';
    const date = new Date(log.received_at);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleString('hu-HU');
  };

  const sendCommand = async (command) => {
    setSending(true);
    setCommandStatus(null);
    if (!COMMAND_API_URL || COMMAND_API_URL.includes('your-api-id')) {
      setCommandStatus({ type: 'error', message: 'Frontend not configured: set REACT_APP_COMMAND_API_URL and rebuild.' });
      setSending(false);
      return;
    }

    // ---------------- ÚJ RÉSZ: Aktuális pozíció automatikus csatolása ----------------
    // 1. Elsődlegesen a valós idejű AppSync adatot próbáljuk használni
    let currentJoints = realtimeJointData;
    
    // 2. Ha az nincs (mert pl. offline a robot), a legfrissebb S3 logból vesszük ki
    if (!currentJoints && logs.length > 0) {
      currentJoints = logs[0]?.data?.joint_positions || logs[0]?.data?.joints;
    }

    // 3. Lemásoljuk a kapott parancsot, hogy ne módosítsuk az eredetit (React best practice)
    const finalCommand = { ...command };
    
    // 4. Ha van aktuális ízületi adatunk, és a felhasználó nem írta be kézzel a JSON-ba, hozzáadjuk
    if (currentJoints && !finalCommand.current_joints && finalCommand.target_xyz) {
      finalCommand.current_joints = currentJoints;
      console.log("Automatikus current_joints hozzáadva az IK parancshoz:", currentJoints);
    }
   
    try {
      const response = await fetch(COMMAND_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ command: finalCommand }) // Itt már a kiegészített parancsot küldjük!
      });

      const data = await response.json();

      if (data.success) {
        setCommandStatus({
          type: 'success',
          message: 'Command sent successfully!',
          details: data
        });
        setTimeout(() => setCommandStatus(null), 5000);
      } else {
        throw new Error(data.error || 'Failed to send command');
      }
    } catch (err) {
      setCommandStatus({
        type: 'error',
        message: err.message
      });
    } finally {
      setSending(false);
    }
  };
  const handleSendCustomCommand = () => {
    if (!commandInput.trim()) return;
    try {
      const command = JSON.parse(commandInput);
      sendCommand(command);
      setCommandInput('');
    } catch (err) {
      setCommandStatus({
        type: 'error',
        message: 'Invalid JSON format'
      });
    }
  };

  const renderRobotData = (data) => {
    if (!data) return <span className="text-gray-500">No data</span>;

    const jointData = data.joint_positions || data.joints;

    return (
      <div className="space-y-2">
        {jointData && (
          <div className="text-xs">
            <span className="text-gray-400">Joints:</span>
            <span className="ml-2 text-gray-300 font-mono">[{jointData.map(j => j?.toFixed(2)).join(', ')}]</span>
          </div>
        )}

        {data.status && (
          <div className="text-xs mt-1">
            <span className="text-gray-400">Status:</span>
            <span className="ml-2 text-green-400">{data.status}</span>
          </div>
        )}

        {Object.keys(data).filter(k => !['position', 'joints', 'status'].includes(k)).length > 0 && (
          <details className="text-xs">
            <summary className="text-gray-400 cursor-pointer hover:text-gray-300">
              More data...
            </summary>
            <pre className="mt-2 p-2 bg-gray-900/50 rounded text-gray-300 font-mono text-[10px] leading-relaxed overflow-x-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Database className="w-10 h-10 text-blue-400" />
              <div>
                <h1 className="text-3xl font-bold">Robot Logs Dashboard</h1>
                <p className="text-gray-400">View robot data from S3 storage</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {lastUpdate && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>Last update: {lastUpdate}</span>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Auto-refresh</span>
              </label>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4 bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => fetchLogs()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <div className="ml-auto flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400">
                {logs.length} log{logs.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-red-400">Error loading logs</div>
              <div className="text-sm text-red-300 mt-1">{error}</div>
            </div>
          </div>
        )}

        {/* Command Status */}
        {commandStatus && (
          <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            commandStatus.type === 'success' ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-500'
          }`}>
            <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              commandStatus.type === 'success' ? 'text-green-400' : 'text-red-400'
            }`} />
            <div>
              <div className={`font-medium ${
                commandStatus.type === 'success' ? 'text-green-400' : 'text-red-400'
              }`}>
                {commandStatus.message}
              </div>
              {commandStatus.details && (
                <div className="text-sm text-gray-300 mt-1 font-mono">
                  Message ID: {commandStatus.details.messageId}
                </div>
              )}
            </div>
          </div>
        )}

        <NewLayout
          loading={loading}
          logs={logs}
          formatTimestamp={formatTimestamp}
          renderRobotData={renderRobotData}
          quickCommands={quickCommands}
          sendCommand={sendCommand}
          sending={sending}
          commandInput={commandInput}
          setCommandInput={setCommandInput}
          handleSendCustomCommand={handleSendCustomCommand}
          realtimeJointData={realtimeJointData}
          isLive={isLive}
        />
      </div>
    </div>
  );
}