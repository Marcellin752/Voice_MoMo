import { ContactResolverService } from '../services/engine/ContactResolverService';
import { MobileNetwork, NetworkDetector } from '../services/engine/NetworkDetector';
import type { ApiUser } from './api';

/**
 * Normalise le numéro émetteur (01XXXXXXXX) et vérifie qu'il est MTN Bénin.
 * Source unique de vérité pour momo.auth.user.phone.
 */
export function normalizeSenderUser(user: ApiUser): ApiUser {
  const resolver = new ContactResolverService();
  const formattedPhone = resolver.formatBeninNumber(user.phone);

  if (NetworkDetector.detectNetwork(formattedPhone) !== MobileNetwork.MTN) {
    throw new Error('Seuls les utilisateurs MTN sont supportés pour l\'instant.');
  }

  return { ...user, phone: formattedPhone };
}
