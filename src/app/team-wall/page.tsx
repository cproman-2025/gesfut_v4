

'use client';

import { useState, useEffect, type ChangeEvent, useRef, useMemo } from 'react';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  increment,
  deleteField,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import type { Post, User, PostComment } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ThumbsUp, MessageCircle, Share2, Send, ImagePlus, X, PlusCircle, Newspaper, Trash2, Sparkles, Edit3, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { generatePostContent } from '@/ai/flows/generate-post-content-flow';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageHeader } from '@/contexts/page-header-context';
import ReactMarkdown from 'react-markdown';
import { useIsMobile } from '@/hooks/use-mobile';


const MAX_IMAGE_URL_LENGTH = 700000; // Approx 700KB for Data URIs


const PostCard: React.FC<{
  post: Post;
  currentUserProfile: User;
  onCommentSubmit: (postId: string, content: string) => Promise<void>;
  onLike: (postId: string) => Promise<void>;
  onDeleteRequest: (postId: string) => void;
  onEditRequest: (post: Post) => void;
  isMainPost?: boolean;
}> = ({ post, currentUserProfile, onCommentSubmit, onLike, onDeleteRequest, onEditRequest, isMainPost = false }) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [postTimeAgo, setPostTimeAgo] = useState<string | null>(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);

  const isLiked = useMemo(() => post.likedBy?.includes(currentUserProfile.id) || false, [post.likedBy, currentUserProfile.id]);
  const likeCount = useMemo(() => post.likes || 0, [post.likes]);

  useEffect(() => {
    const calculateTimeAgo = () => {
      if (post.timestamp instanceof Timestamp) {
        setPostTimeAgo(formatDistanceToNow(post.timestamp.toDate(), { addSuffix: true, locale: es }));
      } else if (post.timestamp instanceof Date) {
        setPostTimeAgo(formatDistanceToNow(post.timestamp, { addSuffix: true, locale: es }));
      }
    };
    calculateTimeAgo();
  }, [post.timestamp]);

  const fetchComments = async () => {
    if (!showComments || comments.length > 0) return; // Fetch only if showing and not already fetched
    setLoadingComments(true);
    try {
      const commentsQuery = query(collection(db, "comments"), where("postId", "==", post.id), orderBy("timestamp", "asc"));
      const querySnapshot = await getDocs(commentsQuery);
      const fetchedComments = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: (data.timestamp as Timestamp).toDate()
        } as PostComment;
      });
      setComments(fetchedComments);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [showComments, post.id]);


  const handleCommentSubmitInternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    await onCommentSubmit(post.id, commentText);
    setCommentText('');
    // Refetch comments after submitting a new one
    const commentsQuery = query(collection(db, "comments"), where("postId", "==", post.id), orderBy("timestamp", "asc"));
    const querySnapshot = await getDocs(commentsQuery);
    setComments(querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data(), timestamp: (doc.data().timestamp as Timestamp).toDate()} as PostComment)));
  };

  const handleLikeInternal = async () => {
    await onLike(post.id);
  };

  const CommentTimestamp: React.FC<{ timestamp: Date | Timestamp | undefined }> = ({ timestamp }) => {
    const [timeAgo, setTimeAgo] = useState<string | null>(null);
    useEffect(() => {
      const calculateTime = () => {
        let dateToFormat: Date | undefined;
        if (timestamp instanceof Timestamp) {
          dateToFormat = timestamp.toDate();
        } else if (timestamp instanceof Date) {
          dateToFormat = timestamp;
        }
        if (dateToFormat) {
          setTimeAgo(formatDistanceToNow(dateToFormat, { addSuffix: true, locale: es }));
        }
      };
      calculateTime();
    }, [timestamp]);
    return timeAgo ? <>{timeAgo}</> : null;
  };

  const canModifyPost = post.authorId === currentUserProfile.id || currentUserProfile.role === 'Administrador';

  return (
    <Card className="shadow-lg overflow-hidden">
      <CardHeader className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 border">
            <AvatarImage src={post.authorAvatarUrl || `https://placehold.co/40x40.png`} alt={post.authorName} data-ai-hint="avatar person" />
            <AvatarFallback>{post.authorName?.substring(0,1) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-semibold">{post.authorName || 'Usuario Desconocido'}</p>
            {postTimeAgo && (
              <p className="text-xs text-muted-foreground">
                {postTimeAgo}
              </p>
            )}
          </div>
          {canModifyPost && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => onEditRequest(post)}>
                <Edit3 className="h-4 w-4" />
                <span className="sr-only">Editar publicación</span>
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => onDeleteRequest(post.id)}>
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Eliminar publicación</span>
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
        {post.imageUrl && (
           <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
            <DialogTrigger asChild>
              <div className="mt-3 rounded-lg overflow-hidden border aspect-video relative shadow-sm cursor-pointer hover:opacity-90 transition-opacity">
                <Image src={post.imageUrl} alt="Publicación de noticias" fill className="object-contain" data-ai-hint="team event" />
              </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-transparent border-0">
              <DialogHeader>
                 <DialogTitle className="sr-only">Imagen de la publicación: {post.content.substring(0, 50)}</DialogTitle>
              </DialogHeader>
              <Image src={post.imageUrl} alt="Publicación de noticias - Vista Ampliada" width={1200} height={900} className="object-contain w-full h-auto max-h-[90vh]" data-ai-hint="team event large"/>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
      <CardFooter className="p-4 border-t flex flex-col items-stretch gap-2 bg-muted/30">
        <div className="flex justify-around">
          <Button variant="ghost" className="flex-1 gap-1.5 text-muted-foreground hover:text-primary" onClick={handleLikeInternal}>
            <ThumbsUp className={cn("h-4 w-4", isLiked && "text-primary fill-primary/20")} />
            {likeCount > 0 && <span>{likeCount}</span>} Me gusta
          </Button>
          <Button variant="ghost" className="flex-1 gap-1.5 text-muted-foreground hover:text-primary" onClick={() => setShowComments(!showComments)}>
            <MessageCircle className="h-4 w-4" />
            {post.commentsCount > 0 && <span>{post.commentsCount}</span>} Comentar
          </Button>
          <Button variant="ghost" className="flex-1 gap-1.5 text-muted-foreground hover:text-primary">
            <Share2 className="h-4 w-4" /> Compartir
          </Button>
        </div>
        {showComments && (
          <div className="mt-2 space-y-3 pt-3 border-t">
            {loadingComments ? <p className="text-xs text-muted-foreground text-center py-2">Cargando comentarios...</p> :
             comments.length > 0 ? comments.map(comment => (
              <div key={comment.id} className="flex items-start gap-2">
                <Avatar className="h-8 w-8 border">
                  <AvatarImage src={comment.authorAvatarUrl || `https://placehold.co/32x32.png`} alt={comment.authorName} data-ai-hint="avatar person" />
                  <AvatarFallback>{comment.authorName?.substring(0,1) || 'U'}</AvatarFallback>
                </Avatar>
                <div className="bg-background p-2.5 rounded-lg flex-1 text-sm shadow-sm">
                  <p className="font-semibold">{comment.authorName || 'Usuario Desconocido'}</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{comment.content}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                     <CommentTimestamp timestamp={comment.timestamp} />
                  </p>
                </div>
              </div>
            )) : <p className="text-xs text-muted-foreground text-center py-2">No hay comentarios aún. ¡Sé el primero!</p>}

            <form onSubmit={handleCommentSubmitInternal} className="flex items-center gap-2 pt-2">
              <Avatar className="h-8 w-8 border">
                <AvatarImage src={currentUserProfile.avatarUrl || `https://placehold.co/32x32.png`} alt={currentUserProfile.name} data-ai-hint="avatar person" />
                <AvatarFallback>{currentUserProfile.name?.substring(0,1) || 'U'}</AvatarFallback>
              </Avatar>
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Escribe un comentario..."
                className="flex-1 h-9"
                autoComplete="off"
              />
              <Button type="submit" size="icon" className="h-9 w-9" disabled={!commentText.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

const CompactPostItem: React.FC<{ post: Post, onSelectPost: (post: Post) => void }> = ({ post, onSelectPost }) => {
    const [timeAgo, setTimeAgo] = useState<string | null>(null);

    useEffect(() => {
        const calculateTimeAgo = () => {
            if (post.timestamp instanceof Timestamp) {
                setTimeAgo(formatDistanceToNow(post.timestamp.toDate(), { addSuffix: true, locale: es }));
            } else if (post.timestamp instanceof Date) {
                setTimeAgo(formatDistanceToNow(post.timestamp, { addSuffix: true, locale: es }));
            }
        };
        calculateTimeAgo();
    }, [post.timestamp]);

    return (
        <button
            onClick={() => onSelectPost(post)}
            className="flex w-full items-start gap-3 p-3 text-left rounded-lg transition-colors hover:bg-muted/50"
        >
            <Avatar className="h-9 w-9 border shrink-0">
                <AvatarImage src={post.authorAvatarUrl || `https://placehold.co/36x36.png`} alt={post.authorName} data-ai-hint="avatar person"/>
                <AvatarFallback className="text-sm">{post.authorName?.substring(0,1) || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{post.authorName}</p>
                <p className="text-sm text-muted-foreground truncate">{post.content.substring(0, 50)}...</p>
                <p className="text-xs text-muted-foreground/80 mt-0.5">{timeAgo}</p>
            </div>
        </button>
    );
};


const PostFormDialog: React.FC<{
  currentUserProfile: User;
  onSubmit: (content: string, imageUrl?: string, existingPostId?: string) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postToEdit?: Post | null;
}> = ({ currentUserProfile, onSubmit, open, onOpenChange, postToEdit }) => {
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();
  const [aiTopic, setAiTopic] = useState('');
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);

  const isEditing = !!postToEdit;

  useEffect(() => {
    if (open) { // Reset form only when dialog opens
      if (isEditing && postToEdit) {
        setContent(postToEdit.content);
        setImagePreview(postToEdit.imageUrl || null);
        setImageFile(null);
        setAiTopic('');
      } else {
        setContent('');
        setImageFile(null);
        setImagePreview(null);
        setAiTopic('');
      }
    }
  }, [isEditing, postToEdit, open]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (file.size > MAX_IMAGE_URL_LENGTH * 1.5) { // A bit of leeway for base64 encoding
            toast({title: "Imagen muy grande", description: "El archivo es demasiado grande. Intenta con uno más pequeño (aprox. 500KB).", variant: "destructive"});
            return;
        }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (result.length > MAX_IMAGE_URL_LENGTH) {
            toast({title: "Imagen muy grande", description: "La imagen procesada es demasiado grande para ser guardada. Por favor, elige una más pequeña.", variant: "destructive"});
            removeImage();
        } else {
            setImagePreview(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    const fileInput = document.getElementById('image-upload-dialog') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleSubmit = async () => {
    if (!content.trim() && !imagePreview) {
      toast({ title: "Error", description: "El contenido o una imagen son necesarios.", variant: "destructive" });
      return;
    }
    await onSubmit(content, imagePreview || undefined, isEditing ? postToEdit?.id : undefined);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  }

  const handleGenerateAiContent = async () => {
    if (!aiTopic.trim()) {
      toast({ title: "Tema Requerido", description: "Por favor, introduce un tema para la IA.", variant: "destructive" });
      return;
    }
    setIsGeneratingContent(true);
    try {
      const result = await generatePostContent({ topic: aiTopic });
      setContent(result.generatedContent);
      toast({ title: "Contenido Generado", description: "Se ha generado un borrador para tu publicación."});
    } catch (error) {
      console.error("Error generating post content:", error);
      toast({ title: "Error de IA", description: "No se pudo generar el contenido.", variant: "destructive" });
    } finally {
      setIsGeneratingContent(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">{isEditing ? 'Editar Noticia' : 'Crear Nueva Noticia'}</DialogTitle>
          <DialogDescription>{isEditing ? 'Modifica el contenido o la imagen de tu noticia.' : 'Comparte información, fotos o actualizaciones con el equipo.'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border">
              <AvatarImage src={currentUserProfile.avatarUrl || `https://placehold.co/40x40.png`} alt={currentUserProfile.name} data-ai-hint="avatar person" />
              <AvatarFallback>{currentUserProfile.name?.substring(0,1) || 'U'}</AvatarFallback>
            </Avatar>
            <p className="font-semibold">{currentUserProfile.name || 'Usuario Desconocido'}</p>
          </div>

          <Separator />

          <div className="space-y-1">
            <Label htmlFor="ai-topic-dialog">Idea para IA (opcional)</Label>
            <div className="flex gap-2">
              <Input
                id="ai-topic-dialog"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Ej: Resumen del partido del domingo"
                className="flex-1"
              />
              <Button onClick={handleGenerateAiContent} disabled={!aiTopic.trim() || isGeneratingContent} variant="outline">
                {isGeneratingContent ? <Sparkles className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {isGeneratingContent ? "Generando..." : "Generar"}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-1">
            <Label htmlFor="post-content-dialog">Contenido</Label>
            <Textarea
              id="post-content-dialog"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="¿Qué estás pensando?"
              rows={4}
            />
          </div>

          {imagePreview && (
            <div className="relative group border rounded-md overflow-hidden shadow-sm">
              <Image src={imagePreview} alt="Vista previa" width={500} height={300} className="object-cover max-h-[300px] w-full" data-ai-hint="image preview"/>
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 opacity-70 group-hover:opacity-100 transition-opacity"
                onClick={removeImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="image-upload-dialog" className="cursor-pointer text-primary hover:underline flex items-center gap-1.5 text-sm py-2">
              <ImagePlus className="h-4 w-4" /> {imagePreview ? 'Cambiar Imagen' : 'Añadir Imagen'}
            </Label>
            <Input id="image-upload-dialog" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>Cancelar</Button>
          <Button type="button" onClick={handleSubmit}>{isEditing ? 'Guardar Cambios' : 'Publicar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


export default function TeamWallPage() {
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const { userProfile, isLoading: authIsLoading } = useAuth();
  const { toast } = useToast();
  const [isPostFormDialogOpen, setIsPostFormDialogOpen] = useState(false);
  const [postToDeleteId, setPostToDeleteId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const { setHeader } = usePageHeader();
  const isMobile = useIsMobile();
  
  const canCurrentUserCreatePost = userProfile?.role === 'Administrador' || userProfile?.role === 'Entrenador';

  const headerAction = useMemo(() => {
    if (!canCurrentUserCreatePost) return undefined;
    return (
      <Button onClick={() => setIsPostFormDialogOpen(true)} size="sm" className="px-2 sm:px-3">
        <PlusCircle className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Crear Noticia</span>
      </Button>
    );
  }, [canCurrentUserCreatePost]);

  useEffect(() => {
    setHeader({
      title: 'Noticias',
      description: 'Últimas noticias, fotos y actualizaciones del equipo.',
      icon: Newspaper,
      action: headerAction,
    });
  }, [setHeader, headerAction]);

  const fetchPosts = async () => {
    if (!userProfile) return;
    setLoadingPosts(true);
    try {
      const postsQuery = query(collection(db, "posts"), orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(postsQuery);
      const fetchedPosts = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: (data.timestamp as Timestamp)?.toDate() || new Date(),
          likes: data.likes || 0,
          commentsCount: data.commentsCount || 0,
          likedBy: data.likedBy || [],
        } as Post;
      });
      setAllPosts(fetchedPosts);
      if (fetchedPosts.length > 0) {
        setSelectedPost(fetchedPosts[0]);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast({ title: "Error al Cargar Noticias", description: "No se pudieron obtener las noticias.", variant: "destructive" });
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (!authIsLoading && userProfile) {
      fetchPosts();
    }
  }, [authIsLoading, userProfile]);

  useEffect(() => {
    // If a post is deleted, and it was the selected one, select the new latest post
    if (selectedPost && !allPosts.find(p => p.id === selectedPost.id)) {
        setSelectedPost(allPosts.length > 0 ? allPosts[0] : null);
    }
  }, [allPosts, selectedPost]);


  if (authIsLoading || !userProfile) {
    return (
      <div className="space-y-6">
        <div className="space-y-6 max-w-2xl mx-auto">
          {[1, 2].map(i => (
            <Card key={i} className="shadow-lg">
              <CardHeader className="p-4"><div className="flex items-start gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-3 w-1/3" /></div></div></CardHeader>
              <CardContent className="p-4 pt-0"><Skeleton className="h-4 w-full mb-2" /><Skeleton className="h-4 w-5/6 mb-3" /><Skeleton className="aspect-video w-full rounded-lg" /></CardContent>
              <CardFooter className="p-4 border-t bg-muted/30"><Skeleton className="h-8 w-full" /></CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const handleFormSubmit = async (content: string, imageUrl?: string, existingPostId?: string) => {
    if (!userProfile) {
      toast({ title: "Error", description: "Debes iniciar sesión para publicar.", variant: "destructive" });
      return;
    }

    if (existingPostId) {
      const postToUpdateRef = doc(db, "posts", existingPostId);
      const postToUpdateData = allPosts.find(p => p.id === existingPostId);
      if (!postToUpdateData || (postToUpdateData.authorId !== userProfile.id && userProfile.role !== 'Administrador')) {
         toast({ title: "Acción no permitida", description: "No puedes editar esta noticia.", variant: "destructive" });
         return;
      }
      try {
        await updateDoc(postToUpdateRef, {
          content,
          imageUrl: imageUrl || deleteField(),
          updatedAt: serverTimestamp(),
        });
        toast({ title: "Noticia Actualizada" });
        fetchPosts(); // Refetch all
        setEditingPost(null);
      } catch (error) {
        console.error("Error updating post:", error);
        toast({ title: "Error al Actualizar", variant: "destructive" });
      }
    } else {
      if (!canCurrentUserCreatePost) {
        toast({ title: "Acción no permitida", description: "No tienes permisos para crear noticias.", variant: "destructive" });
        return;
      }
      try {
        await addDoc(collection(db, "posts"), {
          authorId: userProfile.id,
          authorName: userProfile.name,
          authorAvatarUrl: userProfile.avatarUrl || null,
          content,
          imageUrl: imageUrl || null,
          timestamp: serverTimestamp(),
          likes: 0,
          commentsCount: 0,
          likedBy: [],
        });
        toast({ title: "Noticia Publicada" });
        fetchPosts(); // Refetch all
      } catch (error) {
        console.error("Error creating post:", error);
        toast({ title: "Error al Publicar", variant: "destructive" });
      }
    }
    setIsPostFormDialogOpen(false);
  };

  const handleEditRequest = (post: Post) => {
    setEditingPost(post);
    setIsPostFormDialogOpen(true);
  };

  const handleCommentSubmit = async (postId: string, commentContent: string) => {
    if (!userProfile) return;
    try {
      await addDoc(collection(db, "comments"), {
        postId,
        authorId: userProfile.id,
        authorName: userProfile.name,
        authorAvatarUrl: userProfile.avatarUrl || null,
        content: commentContent,
        timestamp: serverTimestamp(),
      });
      await updateDoc(doc(db, "posts", postId), {
          commentsCount: increment(1)
      });
      toast({ title: "Comentario Añadido" });
      fetchPosts();
    } catch (error) {
        console.error("Error adding comment:", error);
        toast({ title: "Error al Comentar", variant: "destructive" });
    }
  };

  const handleLikePost = async (postId: string) => {
    if (!userProfile) return;
    const userId = userProfile.id;

    const postIndex = allPosts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;

    const originalPosts = [...allPosts];
    const post = originalPosts[postIndex];
    const currentlyLiked = post.likedBy?.includes(userId) || false;
    
    const newLikedBy = currentlyLiked 
      ? post.likedBy?.filter(id => id !== userId) || []
      : [...(post.likedBy || []), userId];

    // Optimistic UI update
    const updatedPost = {
      ...post,
      likedBy: newLikedBy,
      likes: newLikedBy.length
    };
    const updatedPosts = [...allPosts];
    updatedPosts[postIndex] = updatedPost;
    setAllPosts(updatedPosts);
    if(selectedPost?.id === postId) setSelectedPost(updatedPost);
    
    const postRef = doc(db, "posts", postId);
    try {
      await updateDoc(postRef, {
        likedBy: newLikedBy,
        likes: newLikedBy.length
      });
    } catch (error) {
      console.error("Error updating likes:", error);
      toast({ title: "Error al Actualizar 'Me Gusta'", variant: "destructive" });
      // Revert UI on error
      setAllPosts(originalPosts);
    }
  };


  const handleDeleteRequest = (postId: string) => {
    setPostToDeleteId(postId);
  };

  const confirmDeletePost = async () => {
    if (!postToDeleteId || !userProfile) return;

    const postToDeleteData = allPosts.find(p => p.id === postToDeleteId);
     if (!postToDeleteData || (postToDeleteData.authorId !== userProfile.id && userProfile.role !== 'Administrador')) {
        toast({ title: "Acción no permitida", description: "No puedes eliminar esta noticia.", variant: "destructive" });
        setPostToDeleteId(null);
        return;
    }

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "posts", postToDeleteId));
      const commentsQuery = query(collection(db, "comments"), where("postId", "==", postToDeleteId));
      const commentsSnapshot = await getDocs(commentsQuery);
      commentsSnapshot.forEach(commentDoc => batch.delete(commentDoc.ref));

      await batch.commit();
      toast({ title: "Noticia Eliminada" });
      fetchPosts(); 
    } catch (error) {
      console.error("Error deleting post and comments:", error);
      toast({ title: "Error al Eliminar", variant: "destructive" });
    } finally {
      setPostToDeleteId(null);
    }
  };

  const olderPosts = allPosts.filter(p => p.id !== selectedPost?.id);

  if (loadingPosts) {
     return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <Skeleton className="h-[500px] w-full rounded-lg" />
        </div>
        <div className="md:col-span-1 space-y-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (allPosts.length === 0) {
    return (
       <Card className="shadow-lg">
          <CardContent className="py-10 text-center">
              <Newspaper className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium">No hay noticias publicadas</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                  {canCurrentUserCreatePost ? "Sé el primero en compartir algo." : "Aún no hay noticias."}
              </p>
          </CardContent>
       </Card>
    );
  }

  // Mobile view: single column of full posts
  if (isMobile) {
    return (
        <div className="w-full space-y-6">
             <PostFormDialog
                currentUserProfile={userProfile}
                onSubmit={handleFormSubmit}
                open={isPostFormDialogOpen}
                onOpenChange={setIsPostFormDialogOpen}
                postToEdit={editingPost}
            />
            <div className="space-y-6 max-w-2xl mx-auto">
                {allPosts.map(post => (
                    <PostCard
                        key={post.id}
                        post={post}
                        currentUserProfile={userProfile}
                        onCommentSubmit={handleCommentSubmit}
                        onLike={handleLikePost}
                        onDeleteRequest={handleDeleteRequest}
                        onEditRequest={handleEditRequest}
                    />
                ))}
            </div>
             {postToDeleteId && ( <AlertDialog open={!!postToDeleteId} onOpenChange={(isOpen) => { if(!isOpen) setPostToDeleteId(null); }}> <AlertDialogContent> <AlertDialogHeader> <AlertDialogTitle>¿Estás seguro de que quieres eliminar esta noticia?</AlertDialogTitle> <AlertDialogDescription> Esta acción no se puede deshacer. La noticia y todos sus comentarios serán eliminados permanentemente. </AlertDialogDescription> </AlertDialogHeader> <AlertDialogFooter> <AlertDialogCancel onClick={() => setPostToDeleteId(null)}>Cancelar</AlertDialogCancel> <AlertDialogAction onClick={confirmDeletePost} className="bg-destructive text-destructive-foreground hover:bg-destructive/90"> Eliminar Noticia </AlertDialogAction> </AlertDialogFooter> </AlertDialogContent> </AlertDialog> )}
        </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <PostFormDialog
        currentUserProfile={userProfile}
        onSubmit={handleFormSubmit}
        open={isPostFormDialogOpen}
        onOpenChange={setIsPostFormDialogOpen}
        postToEdit={editingPost}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-8 items-start">
        <div className="md:col-span-2 xl:col-span-3 space-y-6">
           {selectedPost ? (
            <PostCard
                key={selectedPost.id}
                post={selectedPost}
                currentUserProfile={userProfile}
                onCommentSubmit={handleCommentSubmit}
                onLike={handleLikePost}
                onDeleteRequest={handleDeleteRequest}
                onEditRequest={handleEditRequest}
                isMainPost={true}
            />
           ) : <p className="text-muted-foreground text-center py-10">Selecciona una noticia para verla aquí.</p>}
        </div>
        <div className="md:col-span-1 xl:col-span-1 space-y-2">
            <h3 className="font-semibold text-lg px-2">Noticias Anteriores</h3>
            <Card className="shadow-lg">
                <CardContent className="p-2">
                    <div className="max-h-[70vh] overflow-y-auto">
                        {olderPosts.length > 0 ? (
                            olderPosts.map(post => <CompactPostItem key={post.id} post={post} onSelectPost={setSelectedPost} />)
                        ) : (
                            <p className="p-4 text-sm text-muted-foreground text-center">No hay más noticias.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
      {postToDeleteId && (
        <AlertDialog open={!!postToDeleteId} onOpenChange={(isOpen) => { if(!isOpen) setPostToDeleteId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro de que quieres eliminar esta noticia?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. La noticia y todos sus comentarios serán eliminados permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPostToDeleteId(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeletePost}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar Noticia
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
      
