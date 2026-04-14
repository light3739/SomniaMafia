import { __mockCall } from './daily-react';

const DailyIframe = {
    createCallObject: jest.fn(() => __mockCall),
    createFrame: jest.fn(() => __mockCall),
};

export default DailyIframe;
