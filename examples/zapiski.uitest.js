import { test } from '@playwright/test';

import { PageRunner } from '../src/runner';


test('Check login and registration forms', async ({ page }) => {
  await PageRunner.new(page, { debug: true })
    .goto('https://zapiski.online')
    .within('.cookiesNotification')
    .expectText('Мы используем cookies для работы сервиса. Продолжая пользоваться сервисом ЗапискиОнлайн, вы принимаете')
    .click('button')
    .dontSeeElement()
    .reloadPage()
    .dontSeeElement()
    .within('#login_frame')
    .expectText('Войти')
    .clickContent('Войти')
    .act(async ({ runner }) => {
      // runner is clone of this with empty call stack.
      // this.click(...) is wrong way, because this.click will be pushed into call stack and will wait when act finished
      // but act will be finished only when this.click finished - stuck.
      // So you need to use runner.click(...) OR this.clone().click(...)
      await runner.click('li:@text(Регистрация)')
        .expectText('Повторите пароль');
    })
    .sayWhere()
    .sayFullPath()
    .expectFetch('/json/m_authf/aj_get_info', {}, { status: 200 })
    .act(async ({ page }) => {
      await page.setViewportSize({ width: 640, height: 640 });
    })
    .dontExpectText('12345');
});
