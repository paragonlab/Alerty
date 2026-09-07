import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import { safeBack } from "../lib/alerty/nav";

export default function PrivacyScreen() {
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => safeBack(router)} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacidad</Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Política de privacidad</Text>
        <Text style={styles.meta}>Última actualización: 7 de septiembre de 2026</Text>
        <Text style={styles.p}>
          Pulso (la app también aparece como Alerty) es un mapa de alertas ciudadanas para
          Culiacán, operado por Gustavo Montoya (“nosotros”). Esta política describe qué
          datos recabamos, para qué los usamos y con quién los compartimos.
        </Text>

        <Text style={styles.h}>1. Datos que recabamos</Text>
        <Text style={styles.p}>
          Cuenta: correo electrónico y, si usas Apple o Google, el identificador que nos
          entrega ese proveedor. Puedes elegir un nombre de usuario público.
        </Text>
        <Text style={styles.p}>
          Ubicación: si das permiso, usamos tu ubicación precisa para mostrar alertas
          cercanas, colocar un reporte o un SOS, y vigilar colonias en Círculo. Las zonas
          que guardas incluyen un punto y un radio.
        </Text>
        <Text style={styles.p}>
          Contenido que publicas: textos, fotos, videos o audio de reportes y publicaciones
          de comunidad. Ese contenido es visible para otros usuarios del mapa y el feed.
        </Text>
        <Text style={styles.p}>
          Notificaciones: token de dispositivo para enviarte avisos de alertas, si las
          activas.
        </Text>
        <Text style={styles.p}>
          Compras: si pagas Círculo o Aliado, el procesador (Apple, Google o Stripe) nos
          confirma el estado de la suscripción. No guardamos números de tarjeta.
        </Text>
        <Text style={styles.p}>
          Uso: eventos de producto (por ejemplo, inicio de sesión) asociados a tu cuenta,
          para operar y mejorar el servicio.
        </Text>

        <Text style={styles.h}>2. Para qué los usamos</Text>
        <Text style={styles.p}>
          Prestar el mapa, los pulsos, el SOS, Círculo y Aliado; autenticarte; enviarte
          avisos que pediste; procesar el pago; moderar contenido; y cumplir obligaciones
          legales. No vendemos tus datos ni los usamos para anuncios de terceros.
        </Text>

        <Text style={styles.h}>3. Con quién los compartimos</Text>
        <Text style={styles.p}>
          Proveedores que nos ayudan a operar: Supabase (base de datos y autenticación),
          Apple y Google (inicio de sesión, mapas y, en su caso, pagos), RevenueCat
          (suscripción Círculo), Stripe (pagos web de Círculo y Aliado), Expo (envío de
          push). Solo reciben lo necesario para su función.
        </Text>
        <Text style={styles.p}>
          Contenido público: reportes, pulsos y pins de Aliado se muestran a quien use
          la app. Los medios pueden aparecer con su nombre y un enlace a su nota.
        </Text>

        <Text style={styles.h}>4. Conservación y tus derechos</Text>
        <Text style={styles.p}>
          Conservamos la cuenta y el contenido mientras el servicio esté activo o hasta
          que borres la cuenta. En Ajustes puedes eliminar tu cuenta: se borran tu perfil,
          zonas de Círculo y votos. Los pulsos que ya publicaste quedan anónimos en el
          mapa. En México también puedes solicitar acceso, rectificación, cancelación u
          oposición al correo de la ficha de App Store.
        </Text>

        <Text style={styles.h}>5. Menores</Text>
        <Text style={styles.p}>
          El servicio no está dirigido a menores de 16 años. Si crees que un menor nos
          dio datos, escríbenos para eliminarlos.
        </Text>

        <Text style={styles.h}>6. Contacto</Text>
        <Text style={styles.p}>
          Gustavo Montoya. Correo de contacto: el publicado en la ficha de App Store.
        </Text>
        <Text style={styles.p}>Sitio: https://alerty-two.vercel.app</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useAlertyTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    headerTitle: {
      fontFamily: theme.fonts.heading,
      fontSize: 16,
      color: theme.colors.text,
    },
    body: { padding: 20, paddingBottom: 48, gap: 10 },
    title: {
      fontFamily: theme.fonts.heading,
      fontSize: 24,
      color: theme.colors.text,
    },
    meta: {
      fontFamily: theme.fonts.body,
      fontSize: 13,
      color: theme.colors.textMuted,
      marginBottom: 8,
    },
    h: {
      fontFamily: theme.fonts.heading,
      fontSize: 16,
      color: theme.colors.text,
      marginTop: 12,
    },
    p: {
      fontFamily: theme.fonts.body,
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.text,
    },
  });
}
