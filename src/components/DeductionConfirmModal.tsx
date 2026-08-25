import React, { useState } from 'react';
import { DeductionProposal } from '../types';
import { ShieldAlert, Check, X, AlertTriangle, Clock } from 'lucide-react';

interface DeductionConfirmModalProps {
  proposal: DeductionProposal | null;
  onRespond: (proposalId: string, accepted: boolean) => Promise<void> | void;
}

export const DeductionConfirmModal: React.FC<DeductionConfirmModalProps> = ({
  proposal,
  onRespond,
}) => {
  const [submitting, setSubmitting] = useState(false);

  if (!proposal) return null;

  const handleChoice = async (accepted: boolean) => {
    try {
      setSubmitting(true);
      await onRespond(proposal.id, accepted);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="deduction-confirm-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
    >
      <div
        id="deduction-confirm-modal-card"
        className="w-full max-w-sm bg-[#FFFDF7] border-3 border-black rounded-3xl shadow-brutal p-5 sm:p-6 text-black relative animate-scale-up"
      >
        {/* Header Badge */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#FF6B6B] border-2 border-black flex items-center justify-center text-white shrink-0 shadow-brutal-sm">
            <ShieldAlert className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black tracking-tight">扣分确认申请</h3>
            <p className="text-xs text-neutral-600 font-bold">需被扣分人本人同意方可生效</p>
          </div>
        </div>

        {/* Content Box */}
        <div className="bg-[#FFF4E0] border-2 border-black rounded-2xl p-4 mb-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-neutral-600 border-b border-black/10 pb-2">
            <span>申请发起人</span>
            <span className="text-black font-black text-sm">{proposal.fromNickname}</span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-xs font-bold text-neutral-600">拟扣除分值</span>
            <span className="text-xl sm:text-2xl font-black text-[#E11D48] tracking-tight">
              -{proposal.amount} <span className="text-xs text-neutral-700 font-bold">分</span>
            </span>
          </div>

          {proposal.note && (
            <div className="text-xs font-bold bg-white/80 rounded-xl p-2.5 border border-black/10 text-neutral-800">
              <span className="text-neutral-500 mr-1">扣分备注:</span>
              <span>{proposal.note}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 pt-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span>若您点击同意，您的分数将被扣除 {proposal.amount} 分</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            id="btn-reject-deduction"
            type="button"
            disabled={submitting}
            onClick={() => handleChoice(false)}
            className="w-full py-3 px-3 rounded-2xl border-2 border-black bg-white hover:bg-neutral-100 active:scale-95 text-neutral-800 font-black text-sm flex items-center justify-center gap-1.5 transition-all shadow-brutal-sm disabled:opacity-50"
          >
            <X className="w-4 h-4 stroke-[3] text-neutral-500" />
            <span>拒绝扣分</span>
          </button>

          <button
            id="btn-accept-deduction"
            type="button"
            disabled={submitting}
            onClick={() => handleChoice(true)}
            className="w-full py-3 px-3 rounded-2xl border-2 border-black bg-[#4ECDC4] hover:bg-[#3dbdb4] active:scale-95 text-black font-black text-sm flex items-center justify-center gap-1.5 transition-all shadow-brutal-sm disabled:opacity-50"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>同意扣分</span>
          </button>
        </div>
      </div>
    </div>
  );
};
