/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // Raised surface, one lightness step above `card`. Nocturne builds
        // depth from these steps rather than drop shadows.
        elevated: "hsl(var(--elevated))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        // Reserved strictly for ticket/check-in states, so amber always
        // means "this is about a ticket" and never decorates anything else.
        signal: {
          DEFAULT: "hsl(var(--signal))",
          foreground: "hsl(var(--signal-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      // Plus Jakarta Sans. React Native does NOT synthesise weights from a
      // single family the way a browser does - each weight is a separately
      // loaded font file and must be named explicitly, which is why these
      // are families rather than `font-weight` utilities.
      // NOTE: these keys deliberately avoid `medium`/`semibold`/`bold`,
      // which would collide with Tailwind's font-WEIGHT utilities of the
      // same name. The distinction matters far more in React Native than
      // on the web: RN cannot synthesise a weight from one family, so the
      // correct font FILE has to be selected by family name.
      fontFamily: {
        sans: ["PlusJakartaSans_400Regular"],
        ui: ["PlusJakartaSans_500Medium"],
        title: ["PlusJakartaSans_600SemiBold"],
        heading: ["PlusJakartaSans_700Bold"],
        display: ["PlusJakartaSans_800ExtraBold"],
      },
      fontSize: {
        eyebrow: ["10px", { lineHeight: "12px", letterSpacing: "2px" }],
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["13px", { lineHeight: "18px" }],
        base: ["15px", { lineHeight: "22px" }],
        lg: ["17px", { lineHeight: "24px" }],
        xl: ["20px", { lineHeight: "26px" }],
        "2xl": ["24px", { lineHeight: "30px", letterSpacing: "-0.4px" }],
        "3xl": ["32px", { lineHeight: "36px", letterSpacing: "-0.8px" }],
        "4xl": ["40px", { lineHeight: "42px", letterSpacing: "-1.2px" }],
      },
      // Deliberately NOT a single uniform radius. Uniform rounding on
      // every element is a generator tell. Artwork and inner cores sit
      // near-square (print/poster language); only outer shells soften.
      borderRadius: {
        none: "0px",
        sm: "2px",
        md: "4px",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 10px)",
        card: "10px",
        art: "3px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
