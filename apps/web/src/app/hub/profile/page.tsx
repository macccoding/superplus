'use client';

import { useEffect, useMemo, useState } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { subscribeToStoreAlerts } from '@/lib/push-notifications';

const monthOptions = [
  ['1', 'Jan'], ['2', 'Feb'], ['3', 'Mar'], ['4', 'Apr'],
  ['5', 'May'], ['6', 'Jun'], ['7', 'Jul'], ['8', 'Aug'],
  ['9', 'Sep'], ['10', 'Oct'], ['11', 'Nov'], ['12', 'Dec'],
];

const colorOptions = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Pink', 'Black', 'White'];

type ProfileForm = {
  preferredName: string;
  birthdayMonth: string;
  birthdayDay: string;
  favoriteColor: string;
  favoriteTreat: string;
  dreamGoal: string;
  proudMoment: string;
  learningInterest: string;
  celebrationPreference: string;
  showBirthday: boolean;
};

const emptyProfileForm: ProfileForm = {
  preferredName: '',
  birthdayMonth: '',
  birthdayDay: '',
  favoriteColor: '',
  favoriteTreat: '',
  dreamGoal: '',
  proudMoment: '',
  learningInterest: '',
  celebrationPreference: '',
  showBirthday: true,
};

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function firstName(name: string) {
  return name.split(' ')[0] || name;
}

function completionCount(form: ProfileForm) {
  return [
    form.preferredName,
    form.favoriteColor,
    form.favoriteTreat,
    form.dreamGoal,
    form.learningInterest,
    form.celebrationPreference,
  ].filter((value) => value.trim().length > 0).length + (form.birthdayMonth && form.birthdayDay ? 1 : 0);
}

export default function ProfilePage() {
  const router = useRouter();
  const { data: user } = trpc.users.me.useQuery();
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
  const [profileReady, setProfileReady] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [showPinChange, setShowPinChange] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);
  const [alertStatus, setAlertStatus] = useState('');
  const { data: vapidKey } = trpc.notifications.publicVapidKey.useQuery();
  const { data: notificationPrefs } = trpc.notifications.preferences.useQuery();
  const { data: pushStatus } = trpc.notifications.pushStatus.useQuery();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!user || profileReady) return;
    setProfileForm({
      preferredName: user.preferredName ?? '',
      birthdayMonth: user.birthdayMonth ? String(user.birthdayMonth) : '',
      birthdayDay: user.birthdayDay ? String(user.birthdayDay) : '',
      favoriteColor: user.favoriteColor ?? '',
      favoriteTreat: user.favoriteTreat ?? '',
      dreamGoal: user.dreamGoal ?? '',
      proudMoment: user.proudMoment ?? '',
      learningInterest: user.learningInterest ?? '',
      celebrationPreference: user.celebrationPreference ?? '',
      showBirthday: user.showBirthday ?? true,
    });
    setProfileReady(true);
  }, [profileReady, user]);

  const profileComplete = completionCount(profileForm);
  const profilePercent = Math.round((profileComplete / 7) * 100);
  const dayOptions = useMemo(() => {
    const month = Number(profileForm.birthdayMonth || 1);
    const days = new Date(2024, month, 0).getDate();
    return Array.from({ length: days }, (_, index) => String(index + 1));
  }, [profileForm.birthdayMonth]);

  const saveProfile = trpc.users.updateMyProfile.useMutation({
    onSuccess: () => {
      setProfileSaved(true);
      utils.users.me.invalidate();
      setTimeout(() => setProfileSaved(false), 2500);
    },
  });

  const registerPush = trpc.notifications.registerPushSubscription.useMutation({
    onSuccess: () => {
      setAlertStatus('Store alerts are on.');
      utils.notifications.pushStatus.invalidate();
    },
    onError: (error) => setAlertStatus(error.message),
  });
  const updatePrefs = trpc.notifications.updatePreferences.useMutation({
    onSuccess: () => utils.notifications.preferences.invalidate(),
  });

  const changePin = trpc.users.changeMyPin.useMutation({
    onSuccess: () => {
      setPinSuccess(true);
      setShowPinChange(false);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setTimeout(() => setPinSuccess(false), 3000);
    },
    onError: (err) => {
      setPinError(err.message);
    },
  });

  if (!user || !profileReady) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
      </div>
    );
  }

  const displayName = profileForm.preferredName.trim() || firstName(user.fullName);

  return (
    <div className="px-5 py-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Profile</h2>
          <p className="text-sm text-on-surface-secondary mt-1">Help your team know and celebrate you.</p>
        </div>
        <div className="w-14 h-14 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-navy">{initials(user.fullName)}</span>
        </div>
      </div>

      <div className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-secondary">My Card</p>
            <h3 className="text-xl font-extrabold text-on-surface mt-1">{displayName}</h3>
            <p className="text-sm text-on-surface-secondary">{user.role} · {user.store.name}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold text-brand">{profilePercent}%</p>
            <p className="text-[11px] font-bold text-on-surface-secondary">complete</p>
          </div>
        </div>
        <div className="mt-4 h-3 rounded-full bg-surface overflow-hidden">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${profilePercent}%` }} />
        </div>
      </div>

      {profileSaved && (
        <div className="bg-success/10 text-success rounded-[--radius-lg] p-4 flex items-center gap-2">
          <span className="material-symbols-outlined">check_circle</span>
          <span className="text-sm font-bold">Profile saved</span>
        </div>
      )}

      <div className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-brand" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
          <div>
            <h3 className="text-lg font-extrabold text-on-surface">About Me</h3>
            <p className="text-xs text-on-surface-secondary">Only managers can see this.</p>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-on-surface-secondary">Preferred Name</span>
          <input value={profileForm.preferredName} onChange={(e) => setProfileForm({ ...profileForm, preferredName: e.target.value })} placeholder="What should we call you?" className="mt-2 w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary" />
        </label>

        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-on-surface-secondary">Birthday</span>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <select value={profileForm.birthdayMonth} onChange={(e) => setProfileForm({ ...profileForm, birthdayMonth: e.target.value, birthdayDay: '' })} className="h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] text-on-surface">
              <option value="">Month</option>
              {monthOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={profileForm.birthdayDay} onChange={(e) => setProfileForm({ ...profileForm, birthdayDay: e.target.value })} className="h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] text-on-surface">
              <option value="">Day</option>
              {dayOptions.map((day) => <option key={day} value={day}>{day}</option>)}
            </select>
          </div>
          <button onClick={() => setProfileForm({ ...profileForm, showBirthday: !profileForm.showBirthday })} className={`mt-3 min-h-12 w-full rounded-[--radius-lg] px-4 text-sm font-bold flex items-center justify-center gap-2 ${profileForm.showBirthday ? 'bg-success/10 text-success' : 'bg-surface text-on-surface-secondary'}`}>
            <span className="material-symbols-outlined text-[20px]">{profileForm.showBirthday ? 'cake' : 'visibility_off'}</span>
            {profileForm.showBirthday ? 'Managers can celebrate my birthday' : 'Keep birthday private'}
          </button>
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-on-surface-secondary">Favourite Color</span>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {colorOptions.map((color) => (
              <button key={color} onClick={() => setProfileForm({ ...profileForm, favoriteColor: color })} className={`min-h-12 rounded-[--radius-lg] text-xs font-bold ${profileForm.favoriteColor === color ? 'bg-brand text-on-brand' : 'bg-surface text-on-surface-secondary'}`}>
                {color}
              </button>
            ))}
          </div>
          <input value={profileForm.favoriteColor} onChange={(e) => setProfileForm({ ...profileForm, favoriteColor: e.target.value })} placeholder="Or type another color" className="mt-2 w-full h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary" />
        </div>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-on-surface-secondary">Favourite Treat</span>
          <input value={profileForm.favoriteTreat} onChange={(e) => setProfileForm({ ...profileForm, favoriteTreat: e.target.value })} placeholder="Snack, drink, or small treat" className="mt-2 w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary" />
        </label>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-on-surface-secondary">Celebrate Me With</span>
          <input value={profileForm.celebrationPreference} onChange={(e) => setProfileForm({ ...profileForm, celebrationPreference: e.target.value })} placeholder="A shoutout, quiet treat, team mention..." className="mt-2 w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary" />
        </label>
      </div>

      <div className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-navy">rocket_launch</span>
          <div>
            <h3 className="text-lg font-extrabold text-on-surface">My Growth</h3>
            <p className="text-xs text-on-surface-secondary">Share goals management can support.</p>
          </div>
        </div>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-on-surface-secondary">Dream or Goal</span>
          <textarea value={profileForm.dreamGoal} onChange={(e) => setProfileForm({ ...profileForm, dreamGoal: e.target.value })} placeholder="Something I am working toward..." rows={3} className="mt-2 w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary resize-none" />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-on-surface-secondary">I Want To Learn</span>
          <input value={profileForm.learningInterest} onChange={(e) => setProfileForm({ ...profileForm, learningInterest: e.target.value })} placeholder="Cashier, stock, supervisor skills..." className="mt-2 w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary" />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-on-surface-secondary">I Am Proud Of</span>
          <textarea value={profileForm.proudMoment} onChange={(e) => setProfileForm({ ...profileForm, proudMoment: e.target.value })} placeholder="A work win, family win, or personal win..." rows={3} className="mt-2 w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary resize-none" />
        </label>
      </div>

      {saveProfile.error && <p className="text-sm font-bold text-error">{saveProfile.error.message}</p>}
      <button
        onClick={() => saveProfile.mutate({
          ...profileForm,
          birthdayMonth: profileForm.birthdayMonth ? Number(profileForm.birthdayMonth) : null,
          birthdayDay: profileForm.birthdayDay ? Number(profileForm.birthdayDay) : null,
        })}
        disabled={saveProfile.isPending}
        className="w-full h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
      >
        <span className={`material-symbols-outlined ${saveProfile.isPending ? 'animate-spin' : ''}`}>{saveProfile.isPending ? 'progress_activity' : 'save'}</span>
        Save Profile
      </button>

      {pinSuccess && (
        <div className="bg-success/10 text-success rounded-[--radius-lg] p-4 flex items-center gap-2">
          <span className="material-symbols-outlined">check_circle</span>
          <span className="text-sm font-medium">PIN changed successfully</span>
        </div>
      )}

      <div className="space-y-3">
        <button onClick={() => router.push('/hub/onboarding?mode=orientation')} className="w-full bg-surface-white rounded-[--radius-lg] p-4 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all border-l-4 border-brand/20">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-brand" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
            <span className="text-sm font-bold text-on-surface">Learn the App</span>
          </div>
          <span className="material-symbols-outlined text-on-surface-secondary text-[20px]">chevron_right</span>
        </button>

        <div className="bg-surface-white rounded-[--radius-lg] p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-brand">notifications_active</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-on-surface">Store Alerts</p>
              <p className="text-xs font-bold text-on-surface-secondary">
                {pushStatus?.configured ? `${pushStatus.subscriptions.length} device${pushStatus.subscriptions.length === 1 ? '' : 's'} connected` : 'In-app alerts are on. Device alerts need setup.'}
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              if (!vapidKey) {
                setAlertStatus('Alerts are not set up yet.');
                return;
              }
              try {
                setAlertStatus('Turning on alerts...');
                const subscription = await subscribeToStoreAlerts(vapidKey);
                registerPush.mutate({
                  endpoint: subscription.endpoint!,
                  keys: {
                    p256dh: subscription.keys!.p256dh!,
                    auth: subscription.keys!.auth!,
                  },
                  userAgent: navigator.userAgent,
                });
              } catch (error) {
                setAlertStatus(error instanceof Error ? error.message : 'Could not turn on alerts.');
              }
            }}
            disabled={registerPush.isPending}
            className="w-full min-h-12 rounded-[--radius-lg] bg-brand text-on-brand font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined ${registerPush.isPending ? 'animate-spin' : ''}`}>{registerPush.isPending ? 'progress_activity' : 'notifications'}</span>
            Turn On Alerts
          </button>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ['threadMentions', '@Me'],
              ['threadReplies', 'Replies'],
              ['urgentThreads', 'Urgent'],
              ['taskAlerts', 'Tasks'],
              ['announcementAlerts', 'Announce'],
              ['stockAlerts', 'Stock'],
              ['incidentAlerts', 'Incidents'],
              ['suggestionResponses', 'Ideas'],
            ].map(([key, label]) => (
              <button key={key} onClick={() => updatePrefs.mutate({ [key]: !(notificationPrefs as any)?.[key] } as any)} className={`min-h-10 rounded-[--radius-lg] text-xs font-bold ${(notificationPrefs as any)?.[key] ?? true ? 'bg-success/10 text-success' : 'bg-surface text-on-surface-secondary'}`}>
                {label}
              </button>
            ))}
          </div>
          {alertStatus && <p className="text-xs font-bold text-on-surface-secondary">{alertStatus}</p>}
        </div>

        <button onClick={() => setShowPinChange(!showPinChange)} className="w-full bg-surface-white rounded-[--radius-lg] p-4 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-navy">lock</span>
            <span className="text-sm font-bold text-on-surface">Change PIN</span>
          </div>
          <span className="material-symbols-outlined text-on-surface-secondary text-[20px]">{showPinChange ? 'expand_less' : 'expand_more'}</span>
        </button>

        {showPinChange && (
          <div className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm space-y-4">
            <input type="password" inputMode="numeric" maxLength={4} value={currentPin} onChange={(e) => { setCurrentPin(e.target.value.replace(/\D/g, '')); setPinError(''); }} placeholder="Current PIN" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-center text-xl tracking-widest text-on-surface placeholder:text-on-surface-secondary transition-colors" />
            <input type="password" inputMode="numeric" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="New PIN" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-center text-xl tracking-widest text-on-surface placeholder:text-on-surface-secondary transition-colors" />
            <input type="password" inputMode="numeric" maxLength={4} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} placeholder="Confirm New PIN" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-center text-xl tracking-widest text-on-surface placeholder:text-on-surface-secondary transition-colors" />
            {pinError && <p className="text-error text-sm text-center flex items-center justify-center gap-1"><span className="material-symbols-outlined text-[16px]">error</span>{pinError}</p>}
            <button onClick={() => {
              if (newPin !== confirmPin) { setPinError('PINs do not match'); return; }
              if (newPin.length !== 4) { setPinError('PIN must be 4 digits'); return; }
              changePin.mutate({ currentPin, newPin });
            }} disabled={currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4 || changePin.isPending} className="w-full h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2">
              {changePin.isPending ? <><span className="material-symbols-outlined animate-spin">progress_activity</span>Updating...</> : 'Update PIN'}
            </button>
          </div>
        )}

        <button onClick={() => signOut({ callbackUrl: '/auth/login' })} className="w-full bg-surface-white rounded-[--radius-lg] p-4 shadow-sm flex items-center gap-3 active:scale-[0.98] transition-all">
          <span className="material-symbols-outlined text-error">logout</span>
          <span className="text-sm font-bold text-error">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
