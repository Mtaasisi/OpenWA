import { parseMobishastraResponse } from './mobishastra-codes.util';

describe('parseMobishastraResponse', () => {
  it('parses leading ShowError=C success code', () => {
    expect(parseMobishastraResponse('000123456789')).toEqual({
      code: '000',
      success: true,
      message: 'Send Successful',
    });
  });

  it('parses leading auth failure code', () => {
    expect(parseMobishastraResponse('005')).toEqual({
      code: '005',
      success: false,
      message: 'Authorization failed',
    });
  });

  it('does not treat Tanzania country code 255 inside body as error code', () => {
    const parsed = parseMobishastraResponse('Send Successful 255743996097');
    expect(parsed.success).toBe(true);
    expect(parsed.code).toBe('000');
  });

  it('parses plain text success responses', () => {
    expect(parseMobishastraResponse('Send Successful')).toMatchObject({
      success: true,
      code: '000',
    });
  });

  it('parses plain text error responses', () => {
    expect(parseMobishastraResponse('Invalid Password')).toMatchObject({
      success: false,
      message: 'Authorization failed',
    });
  });
});
