import { useTranslation } from "~/i18n";

const STEPS = [
  { emoji: "🎧", text: "common.howToPlay.voiceCall" },
  { emoji: "👉", text: "common.howToPlay.choose" },
  { emoji: "👀", text: "common.howToPlay.wait" },
  { emoji: "🚨", text: "common.howToPlay.buzz" },
  { emoji: "🗣️", text: "common.howToPlay.guess" },
  { emoji: "🙊", text: "common.howToPlay.check" },
  { emoji: "⚡", text: "common.howToPlay.swoop" },
  { emoji: "⚖️", text: "common.howToPlay.wager" },
] as const;

export default function HowToPlay() {
  const { t } = useTranslation();
  return (
    <div className="mb-4 rounded-md bg-yellow-100 p-3 shadow-md">
      <p className="mb-2 font-handwriting text-3xl font-black text-yellow-900">
        {t("common.howToPlay.title")}
      </p>
      <ul className="text-sm leading-relaxed text-yellow-700">
        {STEPS.map((step) => (
          <li key={step.text}>
            <span className="text-lg">{step.emoji}</span> {t(step.text)}
          </li>
        ))}
      </ul>
    </div>
  );
}
