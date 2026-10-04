import { t } from './i18n';
import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import type { User } from './api';
export function UserAvatar({ user, large = false }: {
    user: User;
    large?: boolean;
}) {
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [user.id, user.avatarUrl]);
    return <span className={large ? 'profile-avatar' : 'workspace-avatar'}>
    {user.avatarUrl && !failed ? <img className="avatar-image" src={user.avatarUrl} alt={t("Profile photo")} onError={() => setFailed(true)}/> : large ? <UserRound size={30}/> : (user.displayName || user.email).slice(0, 1).toUpperCase()}
  </span>;
}
