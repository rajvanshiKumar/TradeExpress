import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, CircleCheck } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import Input, { Textarea } from '../components/common/Input';
import Button from '../components/common/Button';
import NotFound from './NotFound';
import infoPages from '../data/infoPages';
import useLocalStorage from '../hooks/useLocalStorage';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { STORAGE_KEYS } from '../utils/constants';
import { focusFirstError, hasErrors, rules, validate } from '../utils/validators';

const contactSchema = {
  name: [rules.required('Your name')],
  email: [rules.required('Email'), rules.email()],
  message: [rules.required('Message'), rules.minLength('Message', 10), rules.maxLength('Message', 1000)],
};

function ContactForm() {
  const [, setSaved] = useLocalStorage(STORAGE_KEYS.contactMessages, []);
  const [values, setValues] = useState({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);

  const set = (field) => (event) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: '' }));
  };
  const submit = (event) => {
    event.preventDefault();
    const found = validate(contactSchema, values);
    setErrors(found);
    if (hasErrors(found)) return focusFirstError(found, 'contact-page-');
    setSaved((previous) => [...previous, { ...values, at: new Date().toISOString() }].slice(-20));
    setValues({ name: '', email: '', message: '' });
    return setSent(true);
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-green-200 bg-success-50 p-6 text-center" role="status">
        <CircleCheck className="mx-auto size-10 text-success" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-bold">Message saved</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink">Your note was saved in this browser. Email delivery is not connected yet; the team will see it here once it is.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setSent(false)}>Write another message</Button>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="ts-card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-7">
      <Input id="contact-page-name" label="Your name" required autoComplete="name" value={values.name} onChange={set('name')} error={errors.name} />
      <Input id="contact-page-email" label="Email" required type="email" autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} />
      <Textarea id="contact-page-message" label="Message" required rows={5} value={values.message} onChange={set('message')} error={errors.message} wrapperClassName="sm:col-span-2" />
      <div className="flex justify-end sm:col-span-2"><Button type="submit">Save message</Button></div>
    </form>
  );
}

function Faq({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <ul className="ts-card divide-y">
      {items.map(([question, answer], index) => (
        <li key={question}>
          <h2>
            <button type="button" onClick={() => setOpen(open === index ? -1 : index)} aria-expanded={open === index} aria-controls={`faq-${index}`} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-sans text-[0.9375rem] font-semibold text-navy-900">
              {question}
              <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${open === index ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          </h2>
          {open === index ? <p id={`faq-${index}`} className="px-5 pb-5 text-sm text-ink">{answer}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export default function Info() {
  const { slug } = useParams();
  const page = infoPages[slug];
  useDocumentTitle(page?.title ?? 'Page not found');
  if (!page) return <NotFound />;

  return (
    <>
      <PageHeader breadcrumbs={[{ label: page.title }]} title={page.title} description={page.intro} />
      <div className="ts-container max-w-4xl space-y-6 py-8">
        {page.sections?.map((section) => (
          <section key={section.heading} id={section.id} className="ts-card scroll-mt-40 p-5 sm:p-7">
            <h2 className="text-lg font-bold">{section.heading}</h2>
            {section.body.length > 1 ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-ink">{section.body.map((line) => <li key={line}>{line}</li>)}</ul>
            ) : <p className="mt-3 text-ink">{section.body[0]}</p>}
          </section>
        ))}
        {page.faqs ? <Faq items={page.faqs} /> : null}
        {page.contactForm ? <ContactForm /> : null}
        <div className="flex flex-wrap gap-3">
          <Button to="/products" variant="navy">Browse products</Button>
          {slug !== 'help' ? <Button to="/info/help" variant="outline">Help Center</Button> : <Button to="/info/contact" variant="outline">Contact</Button>}
        </div>
      </div>
    </>
  );
}
