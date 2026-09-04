// ------------------------------------------------------------
// chatfilter.js
// Bleeps rude words in chat when a player has the filter switched on.
// It runs on each player's own screen, so one player can filter and
// another can see the raw text. It is a word list, not magic, but it
// also catches common disguises: sh1t, f*ck, a$$, b!tch, fuuuck.
// ------------------------------------------------------------

const ChatFilter = {
  // Add or remove words here. Matching ignores case, common endings, repeated
  // letters, and the usual symbol-for-letter swaps.
  words: [
    // swearing
    "fuck", "fuk", "fck", "shit", "shite", "bullshit", "bitch", "biatch", "ass", "asshole", "arse", "arsehole", "bastard",
    "damn", "goddamn", "crap", "piss", "dick", "dickhead", "cock", "cunt", "twat", "prick", "wanker", "bollocks", "bugger",
    "motherfucker", "mofo", "douche", "douchebag", "jackass", "dumbass", "smartass",
    // sexual
    "pussy", "whore", "slut", "hoe", "porn", "porno", "penis", "vagina", "boob", "boobs", "tits", "titties", "cum", "jizz",
    "dildo", "blowjob", "handjob", "rape", "rapist", "molest", "pedo", "pedophile", "paedophile",
    // slurs and hate
    "nigger", "nigga", "niga", "negro", "chink", "gook", "spic", "spick", "wetback", "beaner", "kike", "kyke", "raghead",
    "towelhead", "sandnigger", "coon", "jap", "paki", "gypsy", "gyppo", "redskin", "injun", "tranny", "trannie", "shemale",
    "faggot", "fag", "fags", "faggy", "dyke", "homo", "queer", "retard", "retarded", "tard", "spaz", "spastic", "cripple",
    "mongoloid", "nazi", "hitler", "kkk",
    // threats and self-harm bait
    "kys", "killyourself", "kill yourself", "suicide",
  ],
  _regex: null,

  // Letters people swap in to sneak past filters, mapped back to the letter.
  _swaps: { "@": "a", "4": "a", "$": "s", "5": "s", "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "7": "t", "+": "t", "*": "u", "(": "c", "€": "e", "£": "l" },

  // Turn "Sh!!!t" into "shiiit" (same length, so positions still line up with the original).
  _normalize(text) {
    let out = "";
    for (const ch of text) out += this._swaps[ch] || ch.toLowerCase();
    return out;
  },

  // Build one regular expression from the list the first time it is needed.
  // Each letter may repeat (fuuuck), and common endings are allowed.
  _pattern() {
    if (!this._regex) {
      const parts = this.words.map((word) => [...word].map((ch) => (ch === " " ? "\\s*" : `${ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}+`)).join(""));
      this._regex = new RegExp(`(?<![a-z])(?:${parts.join("|")})(?:s|es|ed|ing|er|ers|y|ies)?(?![a-z])`, "gi");
    }
    return this._regex;
  },

  // "shit" -> "s**t": keep the first and last letter so the sentence still reads.
  censor(text) {
    const normalized = this._normalize(text);
    const regex = this._pattern();
    let result = "", last = 0, match;
    regex.lastIndex = 0;
    while ((match = regex.exec(normalized)) !== null) {
      const start = match.index, end = start + match[0].length;
      const original = text.slice(start, end);
      result += text.slice(last, start);
      result += original.length <= 2 ? "*".repeat(original.length) : original[0] + "*".repeat(original.length - 2) + original[original.length - 1];
      last = end;
      if (match[0].length === 0) regex.lastIndex++;
    }
    return result + text.slice(last);
  },
};
