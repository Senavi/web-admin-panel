/**
 * PROJECT: the site's interface texts (buttons, form messages, menu labels).
 * Defaults come from src/site/messages/<locale>.json; admins edit them per
 * language on the pages that show them (`uiTexts: [...]` on pages, globals,
 * collections and forms). Add a language file here to give a language its own
 * defaults; languages without one start from the main language.
 * See docs/CONTENT_SCHEMA.md § Interface texts.
 */
import { defineUiTexts } from '@/core/ui-texts/model';

import en from '../site/messages/en.json';
import uk from '../site/messages/uk.json';

export const uiTexts = defineUiTexts({
  messages: { en, uk },
  namespaces: {
    common: {
      label: 'General',
      texts: {
        skipToContent: 'Skip link at the top of every page',
        menu: 'Menu button on phones',
        mainNavigation: 'Name of the main menu (read by screen readers)',
        language: 'Name of the language switcher',
        home: 'Link to the home page',
        phone: 'Label of the phone number',
      },
    },
    nav: {
      label: 'Menu',
      texts: {
        about: 'Menu link: About',
        team: 'Menu link: Team',
        contact: 'Menu link: Contact',
        blog: 'Menu link: Blog',
      },
    },
    footer: {
      label: 'Footer',
      texts: {
        rights: 'Copyright line',
        contact: 'Footer heading: contact',
        follow: 'Footer heading: social networks',
      },
    },
    contact: {
      label: 'Contact details',
      texts: {
        detailsTitle: 'Heading of the contact details',
        email: 'Label of the email',
        phone: 'Label of the phone',
        address: 'Label of the address',
        hours: 'Label of the opening hours',
      },
    },
    cookie: {
      label: 'Cookie banner',
      texts: {
        text: 'Sentence in the cookie banner',
        privacy: 'Link to the privacy policy in the banner',
        accept: 'Button: accept cookies',
        decline: 'Button: decline cookies',
        settings: 'Footer link that reopens the banner',
        label: 'Name of the banner (read by screen readers)',
      },
    },
    notFound: {
      label: 'Page not found',
      texts: {
        title: 'Heading of the 404 page',
        body: 'Text of the 404 page',
        back: 'Button on the 404 page',
      },
    },
    blog: {
      label: 'Blog',
      texts: {
        readMore: 'Button on blog cards',
        published: 'Date line of a post ({date} is the date)',
        pagination: 'Name of the blog page navigation',
        previous: 'Pagination: newer posts',
        next: 'Pagination: older posts',
        pageOf: 'Pagination: current page ({page} of {count})',
        empty: 'Message when there are no posts',
        latestTitle: 'Heading of the latest posts block',
        allPosts: 'Link to all posts',
        backToBlog: 'Link back to the blog from a post',
        preview: 'Notice in the post preview',
        exitPreview: 'Button to leave the preview',
        tags: 'Label of a post’s tags',
      },
    },
    forms: {
      label: 'Forms',
      texts: {
        'errors.required': 'Error: a required field is empty',
        'errors.tooLong': 'Error: the text is too long',
        'errors.invalidEmail': 'Error: invalid email address',
        'errors.invalidPhone': 'Error: invalid phone number',
        'errors.invalidOption': 'Error: no option chosen',
        'errors.consent': 'Error: consent is not given',
        summaryTitle: 'Heading above the list of errors',
        required: 'Mark of a required field',
        sending: 'Text on the button while sending',
        notConnected: 'Message when the form is not connected',
        rateLimited: 'Message when someone sends too often',
        error: 'Message when sending failed',
        choose: 'First option of a drop-down list',
        sendAnother: 'Button to send another message',
        confirm: 'Question before sending',
      },
    },
  },
});
