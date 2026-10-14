import { useCallback, useEffect, useState } from "react";
import { Linking, Platform, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import {
  Contact,
  ContactField,
  ContactsSortOrder,
  getPermissionsAsync,
  requestPermissionsAsync,
} from "expo-contacts";
import {
  colors,
  friendlyError,
  inviteMessage,
  normalisePhone,
  type ContactMatch,
  type FriendStatus,
} from "@raven/shared";
import { answerFriendRequest, matchContacts, requestFriend } from "../lib/data";
import { Avatar } from "../components/Avatar";
import { Bone, Pulse } from "../components/Skeleton";
import { displayText } from "../components/ui";

const FIELDS = [ContactField.FULL_NAME, ContactField.PHONES] as const;
const E164 = /^\+[1-9]\d{6,14}$/;

type OnRaven = ContactMatch & { contactName: string };
type ToInvite = { key: string; name: string; phone: string };
type Row = { kind: "raven"; item: OnRaven } | { kind: "invite"; item: ToInvite };

type Step =
  | { name: "checking" }
  | { name: "ask" }
  | { name: "denied"; canAskAgain: boolean }
  | { name: "loading" }
  | { name: "ready"; onRaven: OnRaven[]; toInvite: ToInvite[]; limited: boolean }
  | { name: "error"; message: string };

/** Friends from your contacts: who's already on Raven (ask them — they say
 *  yes before your ravens reach each other), and a text invite for everyone
 *  else. Numbers are checked against Raven and kept nowhere (migration
 *  20261014000013, match_contacts). */
export function ContactsScreen({
  inviteUrl,
  onBack,
  onChanged,
}: {
  inviteUrl: string;
  onBack: () => void;
  /** Someone became a friend or got asked — App refreshes counts. */
  onChanged: () => void;
}) {
  const [step, setStep] = useState<Step>({ name: "checking" });
  const [statuses, setStatuses] = useState<Record<string, FriendStatus>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (limited: boolean) => {
    setStep({ name: "loading" });
    try {
      const details = await Contact.getAllDetails(FIELDS, { sortOrder: ContactsSortOrder.GivenName });
      // A contact can have several numbers; any of them can be the one on Raven.
      const nameByPhone = new Map<string, string>();
      const contacts: Array<{ key: string; name: string; phones: string[] }> = [];
      for (const contact of details) {
        const name = contact.fullName?.trim() || "No name";
        const phones = [
          ...new Set(
            (contact.phones ?? [])
              .map((phone) => (phone.number ? normalisePhone(phone.number) : ""))
              .filter((phone) => E164.test(phone)),
          ),
        ];
        if (!phones.length) continue;
        contacts.push({ key: contact.id, name, phones });
        for (const phone of phones) if (!nameByPhone.has(phone)) nameByPhone.set(phone, name);
      }

      const matches = await matchContacts([...nameByPhone.keys()]);
      const seen = new Set<string>();
      const onRaven: OnRaven[] = [];
      for (const match of matches) {
        if (seen.has(match.id)) continue;
        seen.add(match.id);
        onRaven.push({ ...match, contactName: nameByPhone.get(match.phone) ?? match.display_name });
      }
      onRaven.sort((a, b) => a.display_name.localeCompare(b.display_name));
      const matchedPhones = new Set(matches.map((match) => match.phone));
      const toInvite = contacts
        .filter((contact) => !contact.phones.some((phone) => matchedPhones.has(phone)))
        .map((contact) => ({ key: contact.key, name: contact.name, phone: contact.phones[0] }));

      setStatuses(Object.fromEntries(onRaven.map((person) => [person.id, person.status])));
      setStep({ name: "ready", onRaven, toInvite, limited });
    } catch (e) {
      setStep({ name: "error", message: e instanceof Error ? friendlyError(e) : "Couldn't read your contacts." });
    }
  }, []);

  const start = useCallback(
    async (ask: boolean) => {
      const permission = ask ? await requestPermissionsAsync() : await getPermissionsAsync();
      if (permission.granted) {
        await load(permission.accessPrivileges === "limited");
      } else if (!ask && permission.canAskAgain) {
        setStep({ name: "ask" });
      } else {
        setStep({ name: "denied", canAskAgain: permission.canAskAgain });
      }
    },
    [load],
  );

  useEffect(() => {
    start(false);
  }, [start]);

  async function add(person: OnRaven) {
    setBusy(person.id);
    setActionError(null);
    try {
      let next: FriendStatus;
      if (statuses[person.id] === "asked_you") {
        // They asked first: this is a yes.
        await answerFriendRequest(person.id, true);
        next = "friends";
      } else {
        next = await requestFriend(person.id);
      }
      setStatuses((prev) => ({ ...prev, [person.id]: next }));
      onChanged();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  function invite(contact: ToInvite) {
    // iOS reads the message after "&", Android after "?".
    const separator = Platform.OS === "ios" ? "&" : "?";
    Linking.openURL(`sms:${contact.phone}${separator}body=${encodeURIComponent(inviteMessage(inviteUrl))}`);
  }

  const header = (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={[displayText, styles.title]}>Friends in your contacts</Text>
    </View>
  );

  if (step.name !== "ready") {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.body}>
          {step.name === "checking" || step.name === "loading" ? (
            <Pulse style={styles.skeleton}>
              {[0, 1, 2, 3, 4].map((row) => (
                <View key={row} style={styles.row}>
                  <Bone style={{ width: 34, height: 34 }} />
                  <Bone style={{ width: 140, height: 12 }} />
                  <Bone style={{ width: 64, height: 28, marginLeft: "auto" }} />
                </View>
              ))}
            </Pulse>
          ) : step.name === "ask" ? (
            <>
              <Text style={styles.lead}>See which of your contacts are already on Raven.</Text>
              <Text style={styles.hint}>
                Raven checks their numbers against who&apos;s here and doesn&apos;t keep them. Nobody
                is added until they say yes.
              </Text>
              <Pressable
                onPress={() => start(true)}
                style={({ pressed }) => [styles.primary, pressed && { backgroundColor: colors.accentDeep }]}
              >
                <Text style={styles.primaryLabel}>Find friends in your contacts</Text>
              </Pressable>
            </>
          ) : step.name === "denied" ? (
            <>
              <Text style={styles.lead}>Raven can&apos;t see your contacts.</Text>
              <Text style={styles.hint}>
                {step.canAskAgain
                  ? "Allow access and Raven will show who's already here."
                  : "You can switch contacts on for Raven in your phone's settings."}
              </Text>
              <Pressable
                onPress={() => (step.canAskAgain ? start(true) : Linking.openSettings())}
                style={({ pressed }) => [styles.primary, pressed && { backgroundColor: colors.accentDeep }]}
              >
                <Text style={styles.primaryLabel}>{step.canAskAgain ? "Allow access" : "Open settings"}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.lead}>{step.message}</Text>
              <Pressable onPress={() => start(false)} style={styles.secondaryButton}>
                <Text style={styles.secondaryLabel}>Try again</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    );
  }

  const sections = [
    {
      key: "raven",
      title: "On Raven",
      data: step.onRaven.map((item): Row => ({ kind: "raven", item })),
    },
    {
      key: "invite",
      title: "Invite to Raven",
      data: step.toInvite.map((item): Row => ({ kind: "invite", item })),
    },
  ].filter((section) => section.data.length > 0);

  return (
    <SectionList
      style={styles.container}
      contentContainerStyle={styles.list}
      sections={sections}
      keyExtractor={(row) => (row.kind === "raven" ? `r-${row.item.id}` : `i-${row.item.key}`)}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <>
          {header}
          <Text style={styles.hint}>
            Checked against who&apos;s on Raven — the numbers weren&apos;t kept.
          </Text>
          {step.limited && Platform.OS === "ios" ? (
            <Pressable
              onPress={async () => {
                try {
                  await Contact.presentAccessPicker(); // iOS 18+
                } catch {
                  // Older iOS: the system Settings app is the only way to share more.
                  Linking.openSettings();
                  return;
                }
                start(false);
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryLabel}>You shared some contacts — choose more</Text>
            </Pressable>
          ) : null}
          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
        </>
      }
      ListEmptyComponent={<Text style={styles.hint}>No phone numbers in your contacts yet.</Text>}
      renderSectionHeader={({ section }) => (
        <Text style={[displayText, styles.sectionTitle]}>{section.title}</Text>
      )}
      renderItem={({ item: row }) =>
        row.kind === "raven" ? (
          <View style={styles.row}>
            <Avatar profile={row.item} size={34} />
            <View style={styles.rowText}>
              <Text style={styles.rowLabel} numberOfLines={1}>
                {row.item.display_name}
              </Text>
              {row.item.contactName !== row.item.display_name ? (
                <Text style={styles.rowSub} numberOfLines={1}>
                  {row.item.contactName} in your contacts
                </Text>
              ) : null}
            </View>
            <StatusAction
              status={statuses[row.item.id] ?? row.item.status}
              busy={busy === row.item.id}
              onPress={() => add(row.item)}
            />
          </View>
        ) : (
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel} numberOfLines={1}>
                {row.item.name}
              </Text>
            </View>
            <Pressable onPress={() => invite(row.item)} style={styles.ghost} hitSlop={6}>
              <Text style={styles.ghostLabel}>Invite</Text>
            </Pressable>
          </View>
        )
      }
    />
  );
}

/** Add, or Accept if they asked first; a plain label once there's nothing to do. */
function StatusAction({
  status,
  busy,
  onPress,
}: {
  status: FriendStatus;
  busy: boolean;
  onPress: () => void;
}) {
  if (status === "friends") return <Text style={styles.done}>Friends</Text>;
  if (status === "requested") return <Text style={styles.done}>Asked</Text>;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.add, (pressed || busy) && { backgroundColor: colors.accentDeep }]}
    >
      <Text style={styles.addLabel}>
        {busy ? "…" : status === "asked_you" ? "Accept" : "Add"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: { gap: 12, marginBottom: 8 },
  back: { fontSize: 14, fontWeight: "600", color: colors.inkSoft },
  title: { fontSize: 24 },
  body: { paddingHorizontal: 20, gap: 12 },
  list: { padding: 20, paddingBottom: 60 },
  skeleton: { gap: 4 },
  lead: { fontSize: 16, fontWeight: "600", color: colors.ink, marginTop: 8 },
  hint: { fontSize: 13, color: colors.inkSoft, lineHeight: 18, marginBottom: 8 },
  primary: {
    marginTop: 8,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryLabel: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryButton: { alignSelf: "flex-start", paddingVertical: 8 },
  secondaryLabel: { fontSize: 14, fontWeight: "600", color: colors.accent },
  sectionTitle: { fontSize: 18, marginTop: 18, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 15, fontWeight: "600", color: colors.ink },
  rowSub: { fontSize: 12, color: colors.inkFaint },
  add: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  addLabel: { color: "#fff", fontSize: 13, fontWeight: "700" },
  ghost: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  ghostLabel: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  done: { fontSize: 13, fontWeight: "600", color: colors.inkFaint },
  error: { fontSize: 13, color: colors.late, marginBottom: 8 },
});
