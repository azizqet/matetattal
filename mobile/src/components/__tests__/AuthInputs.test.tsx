import { describe, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';

jest.mock('expo-haptics', () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: Object.assign(() => null, { glyphMap: {} }) }));

// eslint-disable-next-line import/first
import { AuthField, KuwaitPhoneField, sanitizeKwPhone } from '../AuthUI';

describe('تنقية رقم التلفون الكويتي', () => {
  test.each([
    ['97706792', '97706792'],
    ['٩٧٧٠٦٧٩٢', '97706792'],
    ['+965 9770 6792', '97706792'],     // لصق بصيغة دولية
    ['0096597706792', '97706792'],      // لصق بصيغة 00965
    ['96597706792', '97706792'],        // تعبئة تلقائية من جهات الاتصال
    ['9770-6792', '97706792'],
    ['977067921234', '97706792'],       // أكثر من 8 → أول 8
    ['96512345', '96512345'],           // رقم محلي يبدأ بـ 965 يبقى كما هو
    ['abc', ''],
  ])('%s → %s', (inp, out) => expect(sanitizeKwPhone(inp)).toBe(out));
});

function Form() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  return (
    <>
      <AuthField icon="account-outline" label="الاسم" value={name} onChangeText={setName} testID="name" />
      <KuwaitPhoneField value={phone} onChangeText={setPhone} testID="phone" />
      <AuthField icon="email-outline" label="البريد" value={email} onChangeText={setEmail} ltr testID="email" />
      <AuthField icon="lock-outline" label="كلمة المرور" value={pw} onChangeText={setPw} ltr secureToggle testID="pw" />
    </>
  );
}

describe('نظام الإدخال الموحّد', () => {
  test('خانة التلفون: قابلة للتحرير، لوحة أرقام، بدون maxLength يقص اللصق، و+965 منفصل عن الرقم', async () => {
    const user = userEvent.setup();
    await render(<Form />);
    const phone = () => screen.getByTestId('phone');
    expect(phone().props.editable).toBe(true);
    expect(phone().props.keyboardType).toBe('number-pad');
    expect(phone().props.maxLength).toBeUndefined();
    expect(screen.getByText('+965')).toBeTruthy();
    await user.type(phone(), '9770');
    expect(phone().props.value).toBe('9770');
    await user.type(phone(), '6792123'); // الزائد عن 8 يُتجاهل
    expect(phone().props.value).toBe('97706792');
    await user.type(phone(), '{Backspace}{Backspace}');
    expect(phone().props.value).toBe('977067');
    await user.clear(phone());
    await user.paste(phone(), '+965 9770 6792');
    expect(phone().props.value).toBe('97706792');
  });

  test('كل خانة تحتفظ بقيمتها: الكتابة في خانة لا تمسح أو تعطّل غيرها', async () => {
    const user = userEvent.setup();
    await render(<Form />);
    await user.type(screen.getByTestId('name'), 'عزيز');
    await user.type(screen.getByTestId('phone'), '97706792');
    await user.type(screen.getByTestId('email'), 'a@b.co');
    await user.type(screen.getByTestId('pw'), 'abc12345');
    await user.type(screen.getByTestId('name'), ' الكويتي');
    expect(screen.getByTestId('name').props.value).toBe('عزيز الكويتي');
    expect(screen.getByTestId('phone').props.value).toBe('97706792');
    expect(screen.getByTestId('email').props.value).toBe('a@b.co');
    expect(screen.getByTestId('pw').props.value).toBe('abc12345');
    for (const id of ['name', 'phone', 'email', 'pw']) expect(screen.getByTestId(id).props.editable).toBe(true);
  });

  test('نفس عنصر الإدخال يبقى (لا إعادة إنشاء مع كل حرف = لا فقدان للتركيز)', async () => {
    await render(<Form />);
    const before = screen.getByTestId('phone');
    await act(async () => { fireEvent.changeText(before, '9'); });
    await act(async () => { fireEvent.changeText(screen.getByTestId('phone'), '97'); });
    expect(screen.getByTestId('phone')).toBe(before);
    expect(before.props.value).toBe('97');
  });

  test('كلمة المرور: العين تُظهر/تُخفي بدون مسح، والحرف بعد إعادة الإخفاء يُكمل النص', async () => {
    const user = userEvent.setup();
    await render(<Form />);
    await user.type(screen.getByTestId('pw'), 'abc12345');
    await user.press(screen.getByTestId('pw-eye'));
    expect(screen.getByTestId('pw').props.secureTextEntry).toBe(false);
    await user.press(screen.getByTestId('pw-eye'));
    expect(screen.getByTestId('pw').props.secureTextEntry).toBe(true);
    await act(async () => { fireEvent.changeText(screen.getByTestId('pw'), 'x'); });
    expect(screen.getByTestId('pw').props.value).toBe('abc12345x');
  });
});

declare const __dirname: string;
const dirName = __dirname;

describe('قاعدة ثابتة لكل خانات الإدخال', () => {
  test('لا writingDirection على أي TextInput في المشروع', async () => {
    type Ent = { name: string; isDirectory: () => boolean };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as { readdirSync: (d: string, o: { withFileTypes: true }) => Ent[]; readFileSync: (f: string, e: string) => string };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as { join: (...p: string[]) => string };
    const root = path.join(dirName, '..', '..');
    const files: string[] = [];
    const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== '__tests__') walk(p); } else if (p.endsWith('.tsx')) files.push(p);
    });
    walk(root);
    const bad = files.filter((f) => {
      const src = fs.readFileSync(f, 'utf8');
      // أي نمط باسم input/phoneInput أو style مباشر على TextInput يحتوي writingDirection
      return /(input|phoneInput|ltr)\s*:\s*\{[^}]*writingDirection/.test(src) || /<TextInput[^>]*writingDirection/s.test(src);
    });
    expect(bad).toEqual([]);
  });
});
