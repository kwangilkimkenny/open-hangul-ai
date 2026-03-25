// ForControl.ts
import type { Table, Shape, Footnote, Endnote, Equation, Chart } from 'hwplib-js';
import { tableToXml } from './controls/ForTable';
import { pictureToXml } from './controls/ForPicture';
import { shapeToXml } from './controls/ForShape';
import { textboxToXml } from './controls/ForTextbox';
import { footnoteToXml } from './controls/ForFootnote';
import { endnoteToXml } from './controls/ForEndnote';
import { equationToXml } from './controls/ForEquation';
import { chartToXml } from './controls/ForChart';
import { fieldBeginToXml, fieldEndToXml } from './controls/ForField';
import { oleToXml, OLEObject, createOLEFallbackImage, hasValidPreview } from './controls/ForOLE';
import { formControlToXml, AnyFormControl } from './controls/ForForm';
import { mediaToXml, MediaObject, createMediaFallbackImage } from './controls/ForMedia';
import { HWPControl, HWPPicture, HWPTextBox } from '../../models/hwp.types';
import { Logger } from '../../util/Logger';

/**
 * Extended control types including special objects
 */
export type ExtendedControlType =
    | 'TABLE' | 'PICTURE' | 'TEXTBOX' | 'SHAPE'
    | 'FOOTNOTE' | 'ENDNOTE' | 'EQUATION' | 'CHART'
    | 'FIELD_BEGIN' | 'FIELD_END'
    | 'OLE' | 'FORM' | 'MEDIA';

/**
 * Control 객체를 OWPML XML로 변환
 * hwplib-js 타입을 적절히 캐스팅하여 각 XML 생성기에 전달
 */
export function controlToXml(control: HWPControl): string {
    let controlXml = '';
    try {
        switch (control.type) {
            case 'TABLE':
                if (control.obj) controlXml = tableToXml(control.obj as Table);
                break;
            case 'PICTURE':
                if (control.obj) controlXml = pictureToXml(control.obj as HWPPicture);
                break;
            case 'TEXTBOX':
                if (control.obj) controlXml = textboxToXml(control.obj as HWPTextBox);
                break;
            case 'SHAPE':
                if (control.obj) controlXml = shapeToXml(control.obj as Shape);
                break;
            case 'FOOTNOTE':
                if (control.obj) controlXml = footnoteToXml(control.obj as Footnote);
                break;
            case 'ENDNOTE':
                if (control.obj) controlXml = endnoteToXml(control.obj as Endnote);
                break;
            case 'EQUATION':
                if (control.obj) controlXml = equationToXml(control.obj as Equation);
                break;
            case 'CHART':
                if (control.obj) controlXml = chartToXml(control.obj as Chart);
                break;
            case 'FIELD_BEGIN':
                if (control.obj) {
                    controlXml = fieldBeginToXml(control.obj as { id?: number; type?: number; autoUpdate?: boolean });
                }
                break;
            case 'FIELD_END':
                controlXml = fieldEndToXml((control.obj as { id?: number })?.id);
                break;
            // New control types (Phase 9)
            case 'OLE':
                if (control.obj) {
                    // Support both OLEObject and HWPOLEObject formats
                    const ole = control.obj as OLEObject;
                    // Use fallback image if no proper preview available
                    controlXml = hasValidPreview(ole)
                        ? oleToXml(ole)
                        : createOLEFallbackImage(ole);
                }
                break;
            case 'FORM':
                if (control.obj) {
                    // Support both AnyFormControl and HWPFormControl formats
                    controlXml = formControlToXml(control.obj as AnyFormControl);
                }
                break;
            case 'MEDIA':
                if (control.obj) {
                    const media = control.obj as MediaObject;
                    // Use fallback image for better compatibility
                    controlXml = media.previewBinDataIDRef
                        ? mediaToXml(media)
                        : createMediaFallbackImage(media);
                }
                break;
            default:
                Logger.debug(`Unknown control type: ${control.type}`);
        }
    } catch (e) {
        Logger.error('Error generating XML for control:', e);
    }
    return controlXml;
}

