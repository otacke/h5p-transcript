/** Class for utility functions */
export default class Util {
  /**
   * Extend an array just like JQuery's extend.
   * @returns {object} Merged objects.
   */
  static extend() {
    for (let i = 1; i < arguments.length; i++) {
      for (let key in arguments[i]) {
        if (Object.prototype.hasOwnProperty.call(arguments[i], key)) {
          if (
            typeof arguments[0][key] === 'object' &&
            typeof arguments[i][key] === 'object'
          ) {
            this.extend(arguments[0][key], arguments[i][key]);
          }
          else {
            arguments[0][key] = arguments[i][key];
          }
        }
      }
    }
    return arguments[0];
  }

  /**
   * Retrieve true string from HTML encoded string.
   * @param {string} input Input string.
   * @returns {string} Output string.
   */
  static htmlDecode(input) {
    var dparser = new DOMParser().parseFromString(input, 'text/html');
    return dparser.documentElement.textContent;
  }

  /**
   * Retrieve string without HTML tags.
   * @param {string} html Input string.
   * @returns {string} Output string.
   */
  static stripHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  /**
   * Format language tag (RFC 5646). Assuming "language-coutry". No validation.
   * Cmp. https://tools.ietf.org/html/rfc5646
   * @param {string} languageCode Language tag.
   * @returns {string} Formatted language tag.
   */
  static formatLanguageCode(languageCode) {
    if (typeof languageCode !== 'string') {
      return languageCode;
    }

    /*
     * RFC 5646 states that language tags are case insensitive, but
     * recommendations may be followed to improve human interpretation
     */
    const segments = languageCode.split('-');
    segments[0] = segments[0].toLowerCase(); // ISO 639 recommendation
    if (segments.length > 1) {
      segments[1] = segments[1].toUpperCase(); // ISO 3166-1 recommendation
    }
    languageCode = segments.join('-');

    return languageCode;
  }

  /**
   * Convert seconds to mp4chaps timecode.
   * @param {number} seconds The time in seconds (float for ms).
   * @returns {string|undefined} The humanized timecode.
   */
  static toMP4ChapsTimecode(seconds) {
    if (typeof seconds !== 'number' || seconds < 0) {
      return;
    }

    // eslint-disable-next-line no-magic-numbers
    const ms = Math.round(1000 * (seconds - Math.floor(seconds)));
    seconds = Math.floor(seconds);

    // eslint-disable-next-line no-magic-numbers
    const hours = Math.floor(seconds / 3600);
    // eslint-disable-next-line no-magic-numbers
    seconds -= hours * 3600;

    // eslint-disable-next-line no-magic-numbers
    const minutes = Math.floor(seconds / 60);
    // eslint-disable-next-line no-magic-numbers
    seconds -= minutes * 60;

    let timecode = '';
    // eslint-disable-next-line no-magic-numbers
    timecode += hours.toString().padStart(2, '0');
    // eslint-disable-next-line no-magic-numbers
    timecode += `:${minutes.toString().padStart(2, '0')}`;
    // eslint-disable-next-line no-magic-numbers
    timecode += `:${seconds.toString().padStart(2, '0')}`;
    // eslint-disable-next-line no-magic-numbers
    timecode += `.${ms.toString().padStart(3, '0')}`;

    return timecode;
  }
}
