import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './LeaderboardPage.css';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const data = await api.getLeaderboard();
      setLeaderboard(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="loader-container"><div className="loader"></div></div>;

  return (
    <div className="leaderboard-page animate-fade-in">
      <h2 className="page-title">🏆 Hall of Legends</h2>
      <p className="page-subtitle">The bravest adventurers who dared to enter the dungeon.</p>

      {leaderboard.length === 0 ? (
        <div className="empty-state panel">
          <div className="empty-icon">🏆</div>
          <h3>No Entries Yet</h3>
          <p>Be the first to complete a run and claim your place!</p>
        </div>
      ) : (
        <div className="lb-table-wrap panel">
          <table className="lb-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Adventurer</th>
                <th>Deepest Floor</th>
                <th>Total Gold</th>
                <th>Runs</th>
                <th>Characters</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => (
                <tr key={entry.id} className={entry.id === user?.id ? 'lb-current-user' : ''}>
                  <td className="lb-rank">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </td>
                  <td className="lb-name">
                    {entry.username}
                    {entry.id === user?.id && <span className="lb-you">(You)</span>}
                  </td>
                  <td className="lb-floor">{entry.deepest_floor}</td>
                  <td className="lb-gold">{entry.total_gold}</td>
                  <td>{entry.total_runs}</td>
                  <td>{entry.total_characters}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
