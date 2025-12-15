import React from 'react';
import { RefreshCw, FileText, Send } from 'lucide-react';

const LogsPanel = ({ loading, logs, formatTimestamp, renderRobotData }) => (
  <div className="w-1/2">
    {loading && logs.length === 0 ? (
      <div className="text-center py-20">
        <RefreshCw className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Loading logs...</p>
      </div>
    ) : logs.length === 0 ? (
      <div className="text-center py-20 bg-gray-800 rounded-xl border border-gray-700">
        <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-xl text-gray-400 mb-2">No logs found</p>
        <p className="text-sm text-gray-500">Try selecting a different date or wait for robot data</p>
      </div>
    ) : (
      <div className="space-y-4">
        {logs.map((log, index) => (
          <div key={log.key || index} className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-sm text-gray-400 mb-1">{formatTimestamp(log.timestamp)}</div>
                {log.message_id && <div className="text-xs text-gray-500 font-mono">ID: {log.message_id}</div>}
              </div>
              <div className="text-xs text-gray-500">{(log.size / 1024).toFixed(2)} KB</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4">{renderRobotData(log.data)}</div>
            <div className="mt-3 text-xs text-gray-500">S3 Key: {log.key}</div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const CommandPanel = ({ quickCommands, sendCommand, sending, commandInput, setCommandInput, handleSendCustomCommand }) => (
  <div className="w-1/2 bg-gray-800 rounded-xl p-6 border border-gray-700 self-start">
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
}) {
  return (
    <div className="flex flex-row gap-6 mb-6">
      <LogsPanel
        loading={loading}
        logs={logs}
        formatTimestamp={formatTimestamp}
        renderRobotData={renderRobotData}
      />
      <CommandPanel
        quickCommands={quickCommands}
        sendCommand={sendCommand}
        sending={sending}
        commandInput={commandInput}
        setCommandInput={setCommandInput}
        handleSendCustomCommand={handleSendCustomCommand}
      />
    </div>
  );
}
