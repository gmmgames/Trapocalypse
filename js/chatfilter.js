// ------------------------------------------------------------
// chatfilter.js
// Bleeps rude words in chat when a player has the filter switched on.
// It runs on each player's own screen, so one player can filter and
// another can see the raw text. It is a simple word list, not magic:
// it catches the common stuff and lets you add to the list.
// ------------------------------------------------------------

const ChatFilter = {
  // Add or remove words here. Matching ignores case and common endings (s, es, ed, ing, er).
  words: [
    "fuck", "shit", "bitch", "asshole", "bastard", "dick", "cunt", "pussy", "cock", "whore", "slut",
    "damn", "crap", "piss", "wanker", "twat", "prick", "bollocks", "motherfucker", "retard", "nigger", "nigga", "faggot", "fag",
  ],
  _regex: null,

  // Build one regular expression from the list the first time it is needed.
  _pattern() {
    if (!this._regex) {
      const escaped = this.words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      this._regex = new RegExp(`\\b(${escaped.join("|")})(s|es|ed|ing|er)?\\b`, "gi");
    }
    return this._regex;
  },

  // "shit" -> "s**t": keep the first and last letter so the sentence still reads.
  censor(text) {
    return text.replace(this._pattern(), (match) => match.length <= 2 ? "*".repeat(match.length) : match[0] + "*".repeat(match.length - 2) + match[match.length - 1]);
  },
};
