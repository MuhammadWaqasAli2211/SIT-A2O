import { GraduationCap, Mail, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Reveal } from '@/components/motion/reveal'
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  YoutubeIcon,
} from '@/components/shared/social-icons'
import { FOOTER_LINKS } from '@/lib/site-data'

const SOCIALS = [
  { label: 'Facebook', Icon: FacebookIcon, href: 'https://facebook.com/saylaniwelfare' },
  { label: 'Instagram', Icon: InstagramIcon, href: 'https://instagram.com/saylaniwelfare' },
  { label: 'LinkedIn', Icon: LinkedinIcon, href: 'https://linkedin.com/company/saylaniwelfare' },
  { label: 'YouTube', Icon: YoutubeIcon, href: 'https://youtube.com/@saylaniwelfare' },
]

export function PublicFooter() {
  return (
    <footer className="relative border-t border-border bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <Reveal className="flex flex-col gap-5">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                <GraduationCap className="size-5" />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-[0.95rem] font-semibold tracking-tight">Saylani</span>
                <span className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Mass IT Training
                </span>
              </span>
            </Link>

            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Free, industry-aligned IT education for everyone. We have trained over a
              quarter of a million students across Pakistan — and every programme costs
              nothing to attend.
            </p>

            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2.5">
                <MapPin className="size-4 shrink-0 text-primary" />
                Bahadurabad Campus, Main University Road, Karachi
              </span>
              <a href="tel:+922111123444" className="flex items-center gap-2.5 transition-colors hover:text-foreground">
                <Phone className="size-4 shrink-0 text-primary" />
                +92 21 111 123 444
              </a>
              <a
                href="mailto:admissions@saylaniwelfare.com"
                className="flex items-center gap-2.5 transition-colors hover:text-foreground"
              >
                <Mail className="size-4 shrink-0 text-primary" />
                admissions@saylaniwelfare.com
              </a>
            </div>

            <div className="flex gap-2">
              {SOCIALS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={social.label}
                  className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary"
                >
                  <social.Icon className="size-4" />
                </a>
              ))}
            </div>
          </Reveal>

          {FOOTER_LINKS.map((group, index) => (
            <Reveal key={group.heading} delay={0.05 * (index + 1)} className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold">{group.heading}</h3>
              <ul className="flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <li key={link.label + link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Saylani Welfare International Trust. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/faq" className="transition-colors hover:text-foreground">
              FAQs
            </Link>
            <Link to="/contact" className="transition-colors hover:text-foreground">
              Contact
            </Link>
            <Link to="/login" className="transition-colors hover:text-foreground">
              Student Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
