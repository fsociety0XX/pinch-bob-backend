export enum StatusCode {
  SUCCESS = 200,
  CREATE = 201,
  NOT_FOUND = 404,
  BAD_REQUEST = 400,
  UNAUTHORISED = 401,
  INTERNAL_SERVER_ERROR = 500,
  NO_CONTENT = 204,
}

export enum Role {
  ADMIN = 'admin',
  CUSTOMER = 'customer',
  STAFF = 'staff',
}
export interface errorObject {
  message?: string;
}

export const CANCELLED = 'Cancelled';
export const brandEnum = ['pinch', 'bob'];
export const inventoryEnum = ['Out of stock', 'Low stock', 'In stock'];
export const notesEnum = ['2', '10', '50'];
export const typeEnum = ['cake', 'bake', 'others'];
export const refImageType = ['customise', 'edible', ''];
export const deliveryTypeEnum = ['single', 'multiple'];
export const couponTypeEnum = [
  'Unlimited use',
  'One time use',
  'Free delivery',
];
export const preparationStatusType = ['Incomplete', 'Complete'];
export const couponApplicableEnum = [
  'Product',
  'Category',
  'All',
  'Supercategory',
];
export const customiseOrderEnums = {
  deliveryType: ['Self-collect', 'Delivery'],
  cakeMsgLocation: [
    'Message on cake',
    'Message on cake board',
    'Message on gift card',
  ],
  baseSponge: ['Chocolate', 'Vanilla', 'Pandan', 'Other'],
  colourCode: [
    'Unassigned',
    'Black & Grey',
    'Deep/Midnight Blue',
    'Green',
    'Orange',
    'Pastel Blue, Teal, Blue, Midnight Blue, Paddlepop',
    'Pink, Coral',
    'Purple, Lilac, Violet',
    'Red, Burgundy',
    'Solid Rainbow, Multi Colour',
    'Yellow, Gold, Ivory, Brown',
    'N/A',
  ],
  ediblePrintType: ['Flat', 'Stand', 'Wall'],
  fondantNameTypes: [
    'Banner',
    'Fondant cubes',
    'Gold fondant names (Flat/Wall)',
    'Gold fondant names (Stand)',
    'Mini fondant names',
    'Name placard',
    'Regular fondant name (Flat/Wall)',
    'Regular fondant name (Stand)',
    'Other',
  ],
  fondantColours: [
    'Pantone 100 U',
    'Pantone 101 U',
    'Pantone 102 U',
    'Pantone 141 U',
    'Pantone 148 U',
    'Pantone 1495',
    'Pantone 176',
    'Pantone 177 U',
    'Pantone 1895',
    'Pantone 1935',
    'Pantone 196',
    'Pantone 197',
    'Pantone 2015',
    'Pantone 210',
    'Pantone 2102',
    'Pantone 2187',
    'Pantone 2196',
    'Pantone 2197',
    'Pantone 2199',
    'Pantone 2201',
    'Pantone 2205 U',
    'Pantone 2227 U',
    'Pantone 2267',
    'Pantone 2272',
    'Pantone 232',
    'Pantone 2322',
    'Pantone 2345',
    'Pantone 2423',
    'Pantone 243',
    'Pantone 2448',
    'Pantone 290',
    'Pantone 292',
    'Pantone 293',
    'Pantone 2935',
    'Pantone 296',
    'Pantone 297',
    'Pantone 298',
    'Pantone 299',
    'Pantone 300',
    'Pantone 301',
    'Pantone 306',
    'Pantone 307',
    'Pantone 310',
    'Pantone 3538',
    'Pantone 372 U',
    'Pantone 373 U',
    'Pantone 374 U',
    'Pantone 4029',
    'Pantone 4625',
    'Pantone 485 U',
    'Pantone 531',
    'Pantone 545',
    'Pantone 580 U',
    'Pantone 600 U',
    'Pantone 628',
    'Pantone 635',
    'Pantone 636',
    'Pantone 637',
    'Pantone 638',
    'Pantone 670',
    'Pantone 677',
    'Pantone 698',
    'Pantone 705',
    'Pantone 706',
    'Pantone 7403 U',
    'Pantone 7444',
    'Pantone 7457',
    'Pantone 7478',
    'Pantone 7481 U',
    'Pantone 7487',
    'Pantone 7620',
    'Other',
  ],
  fondantNumberTypes: [
    'Fondant number (Flat)',
    'Fondant number (Stand)',
    'Fondant number (Wall)',
    'Gold Fondant Number',
    'Gold Fondant number (Flat)',
    'Gold Fondant number (Stand)',
    'Gold Fondant number (Wall)',
    'Other',
  ],
  formStatusEnum: ['New', 'Completed', 'Dismissed'],
  enquiryTypeEnum: ['Regular', 'Business'],
  qtyType: ['Pieces', 'Dozen', ''],
};

export const checkoutSessionFor = {
  customiseCake: '1',
  website: '2',
};

export const SELF_COLLECT = 'Self-collect';
export const REGULAR_DELIVERY = 'Regular Delivery';

export const HITPAY_PAYMENT_PURPOSE = ['standard', 'customised'];
