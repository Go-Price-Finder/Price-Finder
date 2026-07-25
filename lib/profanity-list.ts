/**
 * A basic list of common English profanities and slurs, used by
 * containsProfanity() in lib/validation.ts to block them from usernames at
 * sign-up. This is a simple substring-based filter — it will not catch
 * every possible evasion (leetspeak, spacing tricks, etc.) and, being
 * substring-based, can also flag innocent words that happen to contain a
 * banned word as a substring (the classic "Scunthorpe problem" — e.g. a
 * username containing "ass" as part of a longer word). That tradeoff is
 * intentional for a first pass: it's simple, has no external dependency,
 * and errs toward catching more rather than less. If false positives on
 * legitimate usernames become a real problem, swap this for a
 * word-boundary/tokenized check or a maintained package (e.g. `bad-words`,
 * `leo-profanity`) instead of hand-tuning exceptions here.
 *
 * Deliberately not exhaustive — this covers the common, widely-recognized
 * English profanities and slurs that show up in virtually every public
 * profanity-filter word list, not an attempt at total coverage.
 */
export const PROFANITY_LIST: string[] = [
  "anal",
  "arse",
  "ass",
  "asshole",
  "bastard",
  "bitch",
  "blowjob",
  "boob",
  "chink",
  "cock",
  "coon",
  "crap",
  "cum",
  "cunt",
  "dago",
  "damn",
  "dick",
  "dildo",
  "douche",
  "dyke",
  "fag",
  "faggot",
  "fuck",
  "gook",
  "handjob",
  "hoe",
  "homo",
  "jizz",
  "kike",
  "kraut",
  "nigga",
  "nigger",
  "paki",
  "penis",
  "piss",
  "porn",
  "prick",
  "pussy",
  "queer",
  "retard",
  "sanchez",
  "shit",
  "slut",
  "spic",
  "tits",
  "titty",
  "twat",
  "vagina",
  "wank",
  "wetback",
  "whore",
];
