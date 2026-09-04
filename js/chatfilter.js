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
    "pube", "pubes", "pubic", "smegma", "queef", "ballsack", "nutsack", "cumshot", "gangbang", "milf", "hentai", "boner",
    "orgasm", "wank", "fap", "clit", "anal", "horny", "rimjob", "bukkake", "cameltoe", "skank", "thot", "hooker", "sperm",
    "semen", "schlong", "coochie", "nudes", "sexting", "shag", "bimbo",
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
  // Words from the list that must stand alone to count (see _pattern).
  wholeWords: ["spic", "spick"],
  // Words caught even when glued onto other letters ("bitchboy", "shithead", "fuckface"). Only
  // words that never appear inside an innocent word belong here: "ass" (grass) and "cock"
  // (cockpit) stay whole-word only.
  glueWords: ["fuck", "fuk", "fck", "shit", "bitch", "biatch", "cunt", "whore", "slut", "penis", "vagina", "porn", "pussy",
    "nigger", "nigga", "faggot", "nazi", "hitler", "blowjob", "handjob", "dildo", "jizz", "asshole", "arsehole", "dickhead",
    "wanker", "twat", "retard", "pubes", "pubic", "smegma", "queef", "ballsack", "nutsack", "cumshot", "gangbang", "hentai",
    "bukkake", "rimjob", "motherfucker", "bullshit", "pedophile", "paedophile", "rapist", "kys"],

  _normalize(text) {
    let out = "";
    for (const ch of text) out += this._swaps[ch] || ch.toLowerCase();
    return out;
  },

  // Build one regular expression from the list the first time it is needed.
  // Each letter may repeat (fuuuck), and common endings are allowed.
  _pattern() {
    if (!this._regex) {
      const bodyOf = (word) => [...word].map((ch) => (ch === " " ? "\\s*" : `${ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}+`)).join("");
      const whole = this.words.map((word) => {
        // Short slurs that also start everyday words ("spicy") only count on their own.
        return this.wholeWords.includes(word) ? `(?<![a-z])${bodyOf(word)}(?![a-z])` : bodyOf(word);
      });
      // Whole words (with common endings) as before, or a glue word anywhere inside a longer word.
      const glued = this.glueWords.map(bodyOf);
      this._regex = new RegExp(`(?<![a-z])(?:${whole.join("|")})(?:s|es|ed|ing|er|ers|y|ies)?(?![a-z])|(?:${glued.join("|")})`, "gi");
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

  // For player names: the worst words are refused even when glued inside a longer word
  // ("sh1thead"), unlike chat where "grass" must stay clean. Anything the chat filter
  // would bleep is refused too.
  strictWords: ["fuck", "fuk", "fck", "shit", "cunt", "nigg", "fagg", "bitch", "whore", "slut", "rape", "rapist", "nazi", "hitler", "kys", "dick", "cock", "penis", "vagina", "porn", "pedo"],
  _strictRegex: null,

  isClean(text) {
    if (!this._strictRegex) {
      const parts = this.strictWords.map((word) => [...word].map((ch) => `${ch}+`).join(""));
      this._strictRegex = new RegExp(`(?:${parts.join("|")})`, "i");
    }
    return !this._strictRegex.test(this._normalize(text)) && this.censor(text) === text;
  },
};

// The server uses the same list to refuse rude player names. In the browser "module" does not exist.
if (typeof module !== "undefined") module.exports = ChatFilter;
