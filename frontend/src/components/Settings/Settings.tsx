import { useState, type FormEvent } from "react";
import { useLightMode } from "../../hooks/useLightMode";
import { IconArrowBoxLeft, IconMoon, IconSun } from "../Sidebar/Icons";
import styles from "./Settings.module.css";

export type SettingsSection =
  | "profile"
  | "appearance"
  | "invitations"
  | "workspace"
  | "plan";

const SECTIONS: { key: SettingsSection; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "appearance", label: "Appearance" },
  { key: "invitations", label: "Invitations" },
  { key: "workspace", label: "Workspace" },
  { key: "plan", label: "Plan" },
];

const SEAT_TOTAL = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Member = { id: number; name: string; email: string; owner?: boolean };
type Invite = { id: number; email: string };

const SEED_MEMBERS: Member[] = [
  { id: 1, name: "Alex Okafor", email: "alex@lumi.app", owner: true },
  { id: 2, name: "Maya Achebe", email: "maya@lumi.app" },
  { id: 3, name: "Tobi Lawal", email: "tobi@lumi.app" },
];

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("") || "?";

export default function Settings({
  section,
  onSectionChange,
  onBack,
}: {
  section: SettingsSection;
  onSectionChange: (next: SettingsSection) => void;
  onBack: () => void;
}) {
  const { light, set: setLight } = useLightMode();
  const [name, setName] = useState("Alex Okafor");
  const [profileSaved, setProfileSaved] = useState(false);
  const [members, setMembers] = useState<Member[]>(SEED_MEMBERS);
  const [pending, setPending] = useState<Invite[]>([
    { id: 1, email: "chidi@lumi.app" },
  ]);
  const [invite, setInvite] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [wsName, setWsName] = useState("Lumi");
  const [wsMono, setWsMono] = useState("L");
  const [wsSaved, setWsSaved] = useState(false);
  const [billingNote, setBillingNote] = useState(false);

  const sendInvite = (event: FormEvent) => {
    event.preventDefault();
    const email = invite.trim();
    if (!EMAIL_RE.test(email)) {
      setInviteError("Enter a valid email address.");
      return;
    }
    if (
      pending.some((row) => row.email === email) ||
      members.some((member) => member.email === email)
    ) {
      setInviteError("That person is already invited or a member.");
      return;
    }
    setPending((prev) => [...prev, { id: Date.now(), email }]);
    setInvite("");
    setInviteError(null);
  };

  return (
    <div className={styles.root}>
      <div className={styles.wrap}>
        <div className={styles.head}>
          <button
            type="button"
            aria-label="Back to chat"
            onClick={onBack}
            className={styles.backBtn}
          >
            <IconArrowBoxLeft size={16} />
          </button>
          <h1 className={styles.title}>Settings</h1>
        </div>

        <div className={styles.layout}>
          <nav className={styles.nav} aria-label="Settings sections">
            {SECTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onSectionChange(item.key)}
                className={`${styles.navBtn} ${
                  section === item.key ? styles.navBtnActive : ""
                }`}
              >
                <span>{item.label}</span>
                {item.key === "invitations" && pending.length > 0 && (
                  <span className={styles.navBadge}>{pending.length}</span>
                )}
              </button>
            ))}
          </nav>

          <div className={styles.panel}>
            {section === "profile" && (
              <section className={styles.card}>
                <div className={styles.cardTitle}>Profile</div>
                <p className={styles.cardHint}>
                  How you appear to teammates in this workspace.
                </p>
                <div className={styles.profileRow}>
                  <span className={styles.avatar}>{initialsOf(name)}</span>
                  <span className={styles.profileMeta}>
                    <span className={styles.profileName}>
                      {name.trim() || "Unnamed"}
                    </span>
                    <span className={styles.profileMail}>
                      alex@lumi.app
                    </span>
                  </span>
                </div>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Display name</span>
                  <input
                    className={styles.input}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setProfileSaved(false);
                    }}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Email</span>
                  <input
                    className={`${styles.input} ${styles.inputStatic}`}
                    value="alex@lumi.app"
                    readOnly
                    tabIndex={-1}
                  />
                </label>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={!name.trim()}
                    onClick={() => setProfileSaved(true)}
                  >
                    Save changes
                  </button>
                  {profileSaved && (
                    <span className={styles.savedNote}>Saved</span>
                  )}
                </div>
              </section>
            )}

            {section === "appearance" && (
              <section className={styles.card}>
                <div className={styles.cardTitle}>Appearance</div>
                <p className={styles.cardHint}>
                  The theme applies everywhere, including the chat.
                </p>
                <div
                  className={styles.themeSeg}
                  role="group"
                  aria-label="Theme"
                >
                  <button
                    type="button"
                    aria-pressed={!light}
                    className={!light ? styles.segBtnActive : styles.segBtn}
                    onClick={() => setLight(false)}
                  >
                    <IconMoon size={15} />
                    Dark
                  </button>
                  <button
                    type="button"
                    aria-pressed={light}
                    className={light ? styles.segBtnActive : styles.segBtn}
                    onClick={() => setLight(true)}
                  >
                    <IconSun size={15} />
                    Light
                  </button>
                </div>
              </section>
            )}

            {section === "invitations" && (
              <section className={styles.card}>
                <div className={styles.cardTitle}>Invitations</div>
                <p className={styles.cardHint}>
                  Invite teammates by email and manage who has access.
                </p>
                <div className={styles.seatsHead}>
                  <span className={styles.seatsLabel}>
                    {members.length} of {SEAT_TOTAL} seats used
                  </span>
                  <span className={styles.seatsLabel}>
                    {pending.length} pending
                  </span>
                </div>
                <div className={styles.seatBar}>
                  <span
                    className={styles.seatFill}
                    style={{
                      width: `${Math.min(
                        (members.length / SEAT_TOTAL) * 100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
                <form className={styles.inviteForm} onSubmit={sendInvite}>
                  <input
                    className={styles.input}
                    value={invite}
                    placeholder="teammate@company.com"
                    aria-label="Invitee email"
                    onChange={(event) => {
                      setInvite(event.target.value);
                      setInviteError(null);
                    }}
                  />
                  <button type="submit" className={styles.btn}>
                    Send invite
                  </button>
                </form>
                {inviteError && <p className={styles.error}>{inviteError}</p>}
                {pending.length > 0 && (
                  <div className={styles.list}>
                    <div className={styles.listHead}>Pending invites</div>
                    {pending.map((row) => (
                      <div key={row.id} className={styles.listRow}>
                        <span className={styles.listName}>{row.email}</span>
                        <span className={styles.statusChip}>Pending</span>
                        <button
                          type="button"
                          className={styles.textBtn}
                          onClick={() =>
                            setPending((prev) =>
                              prev.filter((item) => item.id !== row.id),
                            )
                          }
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className={styles.list}>
                  <div className={styles.listHead}>Members</div>
                  {members.map((member) => (
                    <div key={member.id} className={styles.listRow}>
                      <span className={styles.memberAvatar}>
                        {initialsOf(member.name)}
                      </span>
                      <span className={styles.listName}>{member.name}</span>
                      <span
                        className={
                          member.owner ? styles.roleChipOwner : styles.roleChip
                        }
                      >
                        {member.owner ? "Owner" : "Member"}
                      </span>
                      {!member.owner && (
                        <button
                          type="button"
                          className={`${styles.textBtn} ${styles.textBtnDanger}`}
                          onClick={() =>
                            setMembers((prev) =>
                              prev.filter((item) => item.id !== member.id),
                            )
                          }
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {section === "workspace" && (
              <section className={styles.card}>
                <div className={styles.cardTitle}>Workspace</div>
                <p className={styles.cardHint}>
                  Shared settings for everyone in this workspace.
                </p>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Workspace name</span>
                  <input
                    className={styles.input}
                    value={wsName}
                    onChange={(event) => {
                      setWsName(event.target.value);
                      setWsSaved(false);
                    }}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Monogram</span>
                  <input
                    className={styles.input}
                    value={wsMono}
                    maxLength={2}
                    onChange={(event) => {
                      setWsMono(event.target.value);
                      setWsSaved(false);
                    }}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Workspace URL</span>
                  <input
                    className={`${styles.input} ${styles.inputStatic}`}
                    value="lumi.app/lumi"
                    readOnly
                    tabIndex={-1}
                  />
                </label>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={!wsName.trim() || !wsMono.trim()}
                    onClick={() => setWsSaved(true)}
                  >
                    Save changes
                  </button>
                  {wsSaved && <span className={styles.savedNote}>Saved</span>}
                </div>
              </section>
            )}

            {section === "plan" && (
              <section className={styles.card}>
                <div className={styles.cardTitle}>Plan</div>
                <p className={styles.cardHint}>
                  Your current subscription and seat usage.
                </p>
                <div className={styles.planRow}>
                  <span className={styles.planName}>Pro</span>
                  <span className={styles.planPrice}>
                    $12
                    <span className={styles.planUnit}> / seat / month</span>
                  </span>
                </div>
                <div className={styles.planMeta}>
                  <div className={styles.planMetaRow}>
                    <span>Seats</span>
                    <span>
                      {members.length} of {SEAT_TOTAL}
                    </span>
                  </div>
                  <div className={styles.planMetaRow}>
                    <span>Billing</span>
                    <span>Monthly · renews Nov 7, 2026</span>
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => setBillingNote(true)}
                  >
                    Upgrade
                  </button>
                  {billingNote && (
                    <span className={styles.savedNote}>
                      We will email alex@lumi.app about billing.
                    </span>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
