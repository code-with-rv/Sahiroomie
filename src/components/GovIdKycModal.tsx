import React, { useState } from 'react';
import type { UserProfile } from '../types/sahiroomie';
import { Icon } from './Icon';

interface GovIdKycModalProps {
  userProfile: UserProfile;
  onVerified: (result: { badgeToken: string; maskedId: string; driveFolder?: string }) => void;
  onClose: () => void;
}

export const GovIdKycModal: React.FC<GovIdKycModalProps> = ({ userProfile, onVerified, onClose }) => {
  const [idType, setIdType] = useState<'AADHAAR' | 'PAN'>('AADHAAR');
  // 999999990019 passes the official UIDAI Verhoeff checksum
  const [idNumber, setIdNumber] = useState('999999990019');
  const [dob, setDob] = useState('2001-05-14');
  const [txnId, setTxnId] = useState('');
  const [maskedPreview, setMaskedPreview] = useState('');
  const [kycOtp, setKycOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleInitiateKyc = async () => {
    setErrorMsg('');
    setBusy(true);
    try {
      const res = await fetch('/api/kyc/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userProfile.userId || 'USR-DEMO101',
          idType,
          idNumber,
          fullName: userProfile.name,
          dob,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ID validation failed');
      setTxnId(data.transactionId);
      setMaskedPreview(data.maskedId);
      if (data.devPreviewKycOtp) setKycOtp(data.devPreviewKycOtp);
    } catch (err: any) {
      setErrorMsg(err?.message || 'ID validation failed');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmKyc = async () => {
    setErrorMsg('');
    setBusy(true);
    try {
      const res = await fetch('/api/kyc/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txnId, otp: kycOtp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid KYC OTP');
      onVerified({
        badgeToken: data.kyc.badgeToken,
        maskedId: data.kyc.maskedId,
        driveFolder: data.googleDriveStorage?.folderName,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Invalid KYC OTP');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-3">
      <div className="w-full max-w-md p-4 rounded-2xl space-y-3 modal-slide-up" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold">Personal ID Verification (Masked KYC)</h3>
          <button type="button" onClick={onClose} aria-label="Close KYC modal" className="w-10 h-10 flex items-center justify-center">
            <Icon name="close" />
          </button>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Validates Aadhaar (UIDAI Verhoeff checksum) or PAN. Raw ID digits are immediately discarded—only a masked reference is stored.
        </p>

        {!txnId ? (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              {(['AADHAAR', 'PAN'] as const).map((tOpt) => (
                <button
                  key={tOpt}
                  type="button"
                  onClick={() => {
                    setIdType(tOpt);
                    setErrorMsg('');
                    setIdNumber(tOpt === 'AADHAAR' ? '999999990019' : 'ABCDE1234F');
                  }}
                  className={`h-11 rounded-xl border text-xs font-extrabold ${
                    idType === tOpt
                      ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-[#4F46E5] dark:border-[#4F46E5]'
                      : ''
                  }`}
                  style={idType !== tOpt ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
                >
                  {tOpt === 'AADHAAR' ? '12-Digit Aadhaar' : 'PAN Card'}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={idNumber}
              aria-label="Government ID number"
              onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
              placeholder={idType === 'AADHAAR' ? '12-digit Aadhaar number' : 'ABCDE1234F'}
              className="w-full h-11 px-3.5 rounded-xl border text-xs font-mono font-bold outline-none"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
            <div>
              <label className="text-[11px] font-bold block mb-1">Date of Birth (18+ Check)</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border text-xs font-bold outline-none"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            {errorMsg && <p className="text-xs font-bold text-[#DC2626]">{errorMsg}</p>}
            <button
              type="button"
              onClick={handleInitiateKyc}
              disabled={busy}
              className="w-full h-11 rounded-full bg-[#4F46E5] text-white text-xs font-bold disabled:opacity-50"
            >
              {busy ? 'Validating ID...' : `Send ${idType} Verification OTP`}
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="p-3 rounded-xl border text-xs font-bold text-[#059669]" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              Masked ID: {maskedPreview} · Enter 6-digit KYC OTP
            </div>
            <input
              type="text"
              maxLength={6}
              value={kycOtp}
              aria-label="6-digit KYC OTP"
              onChange={(e) => setKycOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="6-digit KYC OTP"
              className="w-full h-11 px-3.5 rounded-xl border text-sm font-mono font-extrabold text-center tracking-widest outline-none"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
            {errorMsg && <p className="text-xs font-bold text-[#DC2626]">{errorMsg}</p>}
            <button
              type="button"
              onClick={handleConfirmKyc}
              disabled={busy || kycOtp.length !== 6}
              className="w-full h-11 rounded-full bg-[#059669] text-white text-xs font-bold disabled:opacity-50"
            >
              {busy ? 'Verifying KYC...' : 'Verify ID & Save Badge'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
