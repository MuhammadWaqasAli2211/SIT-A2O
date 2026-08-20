import { MessageCircleQuestion, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Reveal } from '@/components/motion/reveal'
import { PageHero } from '@/components/shared/page-hero'
import { Section } from '@/components/shared/section'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FAQS } from '@/lib/site-data'

export default function FaqPage() {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return FAQS

    return FAQS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.q.toLowerCase().includes(needle) || item.a.toLowerCase().includes(needle),
      ),
    })).filter((group) => group.items.length > 0)
  }, [query])

  const total = results.reduce((sum, group) => sum + group.items.length, 0)

  return (
    <>
      <PageHero
        eyebrow="Support"
        title="Frequently asked questions"
        description="Answers to what applicants ask us most. If yours is not here, the admissions team is a message away."
        crumbs={[{ label: 'FAQs' }]}
      >
        <div className="relative max-w-md">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions..."
            aria-label="Search frequently asked questions"
            className="pl-9"
          />
        </div>
      </PageHero>

      <Section>
        {query && (
          <Reveal className="mb-8">
            <p className="text-sm text-muted-foreground">
              {total === 0
                ? 'No questions match your search.'
                : `${total} ${total === 1 ? 'question' : 'questions'} matching "${query}"`}
            </p>
          </Reveal>
        )}

        {results.length === 0 ? (
          <Reveal className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-border py-20 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <MessageCircleQuestion className="size-6" />
            </span>
            <div className="flex flex-col gap-1.5">
              <p className="font-medium">Nothing found</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Try a different wording, or ask us directly — we usually reply within one
                working day.
              </p>
            </div>
            <Button render={<Link to="/contact" />}>Contact admissions</Button>
          </Reveal>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-12">
            {results.map((group, groupIndex) => (
              <Reveal key={group.category} delay={groupIndex * 0.08}>
                <h2 className="mb-5 text-sm font-semibold uppercase tracking-widest text-primary">
                  {group.category}
                </h2>
                <Accordion className="w-full">
                  {group.items.map((item) => (
                    <AccordionItem key={item.q} value={item.q}>
                      <AccordionTrigger className="text-left text-sm font-medium">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Reveal>
            ))}
          </div>
        )}
      </Section>

      <Section className="border-t border-border bg-muted/25">
        <Reveal>
          <Card className="mx-auto max-w-3xl border-primary/25 bg-primary/5">
            <CardContent className="flex flex-col items-center gap-5 p-10 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary">
                <MessageCircleQuestion className="size-6" />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold">Still have a question?</h2>
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                  Our admissions team answers queries about eligibility, deadlines, and
                  programme content every working day.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button render={<Link to="/contact" />}>Contact us</Button>
                <Button render={<Link to="/admissions" />} variant="outline">
                  Admissions guide
                </Button>
              </div>
            </CardContent>
          </Card>
        </Reveal>
      </Section>
    </>
  )
}
