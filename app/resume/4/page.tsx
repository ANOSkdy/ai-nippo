import Link from 'next/link';

const sections = [
  {
    id: 'certifications',
    label: '資格・免許',
    description: '取得した資格や免許を任意で記入してください。',
    placeholder: '例: 普通自動車第一種運転免許（2018年取得）',
  },
  {
    id: 'awards',
    label: '受賞歴・表彰',
    description: '表彰歴や受賞歴があれば入力してください。',
    placeholder: '例: 2023年 社内改善アワード 最優秀賞',
  },
  {
    id: 'activities',
    label: '社外活動・ボランティア',
    description: 'ボランティア活動や社外プロジェクトなど任意で記載できます。',
    placeholder: '例: 地域清掃プロジェクトのリーダー（2022年〜）',
  },
];

export default function ResumeStep4Page() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-indigo-600">STEP 4 / 6</p>
        <h1 className="text-2xl font-semibold text-gray-900">追加情報の入力</h1>
        <p className="text-sm text-gray-600">
          任意の項目として資格・受賞歴・社外活動などの情報を追記できます。入力しなくても次のステップへ進めます。
        </p>
      </header>

      <form className="space-y-6">
        {sections.map((section) => (
          <section key={section.id} className="space-y-2">
            <div>
              <label htmlFor={section.id} className="block text-sm font-medium text-gray-800">
                {section.label}
              </label>
              <p className="text-xs text-gray-500">{section.description}</p>
            </div>
            <textarea
              id={section.id}
              name={section.id}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              rows={4}
              placeholder={section.placeholder}
            />
          </section>
        ))}

        <div className="flex items-center justify-between gap-3">
          <Link
            href="/resume/3"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            戻る
          </Link>
          <Link
            href="/resume/5"
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            次へ
          </Link>
        </div>
      </form>
    </main>
  );
}
