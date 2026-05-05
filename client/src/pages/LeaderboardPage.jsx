import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';
import api from '../utils/api';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const { playTrack } = useAudio();

  useEffect(() => {
    playTrack('final_fantasy.mp3');
    loadLeaderboard();
  }, [playTrack]);

  const loadLeaderboard = async () => {
    try {
      const data = await api.getLeaderboard();
      setLeaderboard(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4"><div className="w-12 h-12 border-4 border-dark-border border-t-gold rounded-full animate-spin"></div><p className="text-gray-400 font-serif italic">Consulting the archives...</p></div>;

  return (
    <div className="max-w-5xl mx-auto animate-fade-in pb-12">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-title font-bold text-gold drop-shadow-md mb-2 flex items-center justify-center gap-3">
          <span className="text-4xl">🏆</span> Hall of Legends
        </h2>
        <p className="text-gray-400 font-serif italic">The bravest adventurers who dared to enter the dungeon.</p>
      </div>

      {leaderboard.length === 0 ? (
        <div className="text-center py-20 panel bg-dark-surface/40 border-gold/30 shadow-[0_0_40px_rgba(255,183,3,0.05)]">
          <div className="text-6xl mb-6 opacity-80 animate-float">🏆</div>
          <h3 className="font-title text-2xl text-gold mb-3 drop-shadow-sm">No Entries Yet</h3>
          <p className="text-gray-400 mb-8 font-serif italic">Be the first to complete a run and claim your place!</p>
        </div>
      ) : (
        <div className="panel p-0 overflow-hidden bg-dark-surface/80 border-gold/20 shadow-[0_0_40px_rgba(255,183,3,0.05)] relative z-10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-dark-bg/80 border-b border-dark-border">
                  <th className="font-title text-xs uppercase tracking-widest text-gray-500 p-4 text-center w-20">Rank</th>
                  <th className="font-title text-xs uppercase tracking-widest text-gray-500 p-4">Adventurer</th>
                  <th className="font-title text-xs uppercase tracking-widest text-gray-500 p-4 text-center">Deepest Floor</th>
                  <th className="font-title text-xs uppercase tracking-widest text-gray-500 p-4 text-right">Total Gold</th>
                  <th className="font-title text-xs uppercase tracking-widest text-gray-500 p-4 text-center">Runs</th>
                  <th className="font-title text-xs uppercase tracking-widest text-gray-500 p-4 text-center">Characters</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, i) => {
                  const isMe = entry.id === user?.id;
                  
                  // Styling based on rank
                  let rankStyle = "text-gray-400 font-bold";
                  if (i === 0) rankStyle = "text-yellow-400 font-bold text-xl drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]";
                  else if (i === 1) rankStyle = "text-gray-300 font-bold text-xl drop-shadow-[0_0_5px_rgba(209,213,219,0.8)]";
                  else if (i === 2) rankStyle = "text-amber-600 font-bold text-xl drop-shadow-[0_0_5px_rgba(217,119,6,0.8)]";

                  return (
                    <tr key={entry.id} className={`transition-colors duration-200 border-b border-dark-border/50 hover:bg-dark-hover ${isMe ? 'bg-gold/5 border-l-4 border-l-gold' : 'border-l-4 border-l-transparent'}`}>
                      <td className={`p-4 text-center ${rankStyle}`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${isMe ? 'text-gold' : 'text-gray-200'}`}>{entry.username}</span>
                          {isMe && <span className="text-[9px] bg-gold/20 text-gold border border-gold/40 px-1.5 py-0.5 rounded uppercase tracking-wider">You</span>}
                        </div>
                      </td>
                      <td className="p-4 text-center font-title text-gold font-bold">{entry.deepest_floor}</td>
                      <td className="p-4 text-right font-medium text-yellow-500/90">{entry.total_gold} 💰</td>
                      <td className="p-4 text-center text-gray-300">{entry.total_runs}</td>
                      <td className="p-4 text-center text-gray-400">{entry.total_characters}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
