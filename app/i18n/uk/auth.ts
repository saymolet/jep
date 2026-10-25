import type { auth as en } from "../en/auth";
import type { Dictionary } from "../types";

/** Ukrainian messages: auth. */
export const auth: Dictionary<typeof en> = {
  "auth.login.metaTitle": "Вхід",
  "auth.login.title": "Увійти",
  "auth.login.intro":
    "Увійди, щоб завантажувати ігри за посиланням або приватні, редагувати й видаляти свої ігри та зберігати налаштування для всіх ігор.",
  "auth.login.submit": "Увійти",
  "auth.login.forgotPassword": "Забув пароль?",
  "auth.login.noAccount": "Ще не маєш акаунта?",
  "auth.login.signUpLink": "Зареєструватися",
  "auth.login.invalidCredentials": "Неправильна пошта або пароль",
  "auth.signup.metaTitle": "Реєстрація",
  "auth.signup.title": "Реєстрація",
  "auth.signup.intro":
    "Зареєструйся, щоб завантажувати ігри за посиланням або приватні, редагувати й видаляти свої ігри та зберігати налаштування для всіх ігор.",
  "auth.signup.submit": "Зареєструватися",
  "auth.signup.haveAccount": "Уже маєш акаунт?",
  "auth.signup.logInLink": "Увійти",
  "auth.signup.userExists": "Акаунт із цією поштою вже існує — просто увійди",
  "auth.signup.created":
    "Акаунт створено! Перевір пошту — там посилання для підтвердження.",
  "auth.or": "або",
  "auth.emailAddress": "Електронна пошта",
  "auth.emailPlaceholder": "Пошта",
  "auth.password": "Пароль",
  "auth.passwordPlaceholder": "Пароль",
  "auth.continueWithGoogle": "Продовжити з Google",
  "auth.continueWithDiscord": "Продовжити з Discord",
  "auth.unknownError": "Невідома помилка",
  "auth.passwordTooShort": "Пароль має містити щонайменше 6 символів",
  "auth.passwordsDontMatch": "Паролі не збігаються",
  "auth.invalidEmail": "Введи правильну адресу пошти",
  "auth.forgot.metaTitle": "Забув пароль",
  "auth.forgot.title": "Забув пароль",
  "auth.forgot.intro":
    "Введи свою пошту, і ми надішлемо посилання для скидання пароля.",
  "auth.forgot.sent":
    "Якщо акаунт із цією поштою існує, незабаром прийде лист із посиланням для скидання пароля.",
  "auth.forgot.submit": "Надіслати посилання",
  "auth.forgot.backToLogin": "Назад до входу",
  "auth.reset.metaTitle": "Скидання пароля",
  "auth.reset.title": "Скидання пароля",
  "auth.reset.success": "Пароль успішно змінено.",
  "auth.reset.goToProfile": "До профілю",
  "auth.reset.intro": "Введи новий пароль.",
  "auth.reset.newPassword": "Новий пароль",
  "auth.reset.confirmPassword": "Повтори новий пароль",
  "auth.reset.confirmPlaceholder": "Повтори пароль",
  "auth.reset.submit": "Змінити пароль",
  "auth.reset.invalidLink":
    "Посилання недійсне або застаріле. Запитай нове посилання для скидання пароля.",
  "auth.reset.failed": "Не вдалося скинути пароль",
  "auth.account.currentPasswordRequired": "Введи поточний пароль",
  "auth.account.currentPasswordIncorrect": "Поточний пароль неправильний",
  "auth.account.updatePasswordFailed": "Не вдалося змінити пароль",
  "auth.account.updateEmailFailed": "Не вдалося змінити пошту",
  "auth.account.typeEmailToConfirm": "Введи свою пошту, щоб підтвердити",
  "auth.account.emailMismatch": "Пошта не збігається",
  "auth.account.deleteFailed": "Не вдалося видалити акаунт",
};
