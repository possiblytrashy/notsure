export default function VotingBar({ name, votes, totalVotes, colorClass }) {
  const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

  return (
    <div className="space-y-2 mb-6">
      <div className="flex justify-between items-end">
        <span className="text-lg font-bold text-gray-800">{name}</span>
        <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
          {percentage}%
        </span>
      </div>
      <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden border border-white shadow-inner">
        <div 
          className={`h-full ${colorClass} transition-all duration-1000 ease-out relative`}
          style={{ width: `${percentage}%` }}
        >
          {/* Animated Shimmer Effect */}
          <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite] skew-x-12" />
        </div>
      </div>
      <p className="text-right text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
        {votes.toLocaleString()} Verified Votes
      </p>
    </div>
  );
}
