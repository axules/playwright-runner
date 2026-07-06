import { test } from '@playwright/test';

import { PageRunner } from '../src/runner';


test('Check login and registration forms', async ({ page }) => {
  await PageRunner.create(page, { debug: true })
    .goto('https://zapiski.online')
    .within('.cookiesNotification')
    .seeText('Мы используем cookies для работы сервиса. Продолжая пользоваться сервисом ЗапискиОнлайн, вы принимаете')
    .click('button')
    .dontSeeElement()
    .reloadPage()
    .dontSeeElement()
    .within('#login_frame')
    .seeText('Войти')
    .click('li:@text(Регистрация)')
    .seeText('Повторите пароль')
    .where()
    .fullPath()
    .run();
});
